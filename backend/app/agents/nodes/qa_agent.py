"""
Step 9: QA Agent Node
Handles user questions by retrieving relevant code chunks and generating answers.
Uses the high-capacity Nemotron model.

Input:  QAState with question, repo_id, session_id, chat_history
Output: QAState with answer, retrieved_chunks, highlight_node_id, 
        code_ref, source_files
"""

import json
from typing import Dict, Any, List
from app.agents.state import QAState, CodeRef
from app.core.llm import get_chat_llm
from app.core.embeddings import get_embeddings
from app.core.vector_store import get_chroma_client
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

SYSTEM_PROMPT = """
You are RepoHawk, an expert AI assistant specialized in codebase exploration.
Your goal is to answer questions about the repository using the provided code snippets.

### Rules:
1. Use the provided context chunks to answer the question.
2. If the answer isn't in the chunks, say you don't know based on the current context.
3. If relevant, suggest which diagram node should be highlighted (e.g. a specific class or module).
4. Provide a small JSON snippet at the end of your response for metadata.

### Output format:
Your response should be natural language, followed by EXACTLY this JSON block at the very end:
---METADATA---
{{
  "highlight_node_id": "suggested-node-id-to-focus",
  "code_ref": {{ "file": "path/to/file.py", "line_start": 10, "line_end": 20 }},
  "source_files": ["file1.py", "file2.py"]
}}
"""

def qa_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: Performed RAG retrieval and question answering.
    """
    question = state.get("question")
    repo_id = state.get("repo_id")
    chat_history = state.get("chat_history", [])

    if not repo_id:
        return {"error": "Missing repo_id", "answer": "I'm sorry, I don't have a repository context."}

    try:
        # 1. RAG Retrieval
        embeddings_model = get_embeddings()
        question_vector = embeddings_model.embed_query(question)
        
        client = get_chroma_client()
        collection_name = f"repo_{repo_id.replace('-', '_')}"
        collection = client.get_collection(name=collection_name)
        
        results = collection.query(
            query_embeddings=[question_vector],
            n_results=5
        )
        
        chunks = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        
        context_str = "\n\n".join([f"Source: {m['path']}\n{c}" for c, m in zip(chunks, metadatas)])
        source_files = list(set([m["path"] for m in metadatas]))

        # 2. Build Messages
        messages = [SystemMessage(content=SYSTEM_PROMPT)]
        
        # Add context as a system message or human message preamble
        messages.append(SystemMessage(content=f"CODE CONTEXT:\n{context_str}"))
        
        # Add history
        messages.extend(chat_history)
        
        # Add current question
        messages.append(HumanMessage(content=question))

        # 3. Invoke LLM
        llm = get_chat_llm()
        response = llm.invoke(messages)
        content = response.content

        # 4. Parse Metadata from response
        highlight_node_id = ""
        code_ref = {}
        
        if "---METADATA---" in content:
            parts = content.split("---METADATA---")
            answer_text = parts[0].strip()
            try:
                metadata = json.loads(parts[1].strip())
                highlight_node_id = metadata.get("highlight_node_id", "")
                code_ref = metadata.get("code_ref", {})
            except:
                answer_text = content # Fallback if JSON parse fails
        else:
            answer_text = content

        return {
            "answer": answer_text,
            "retrieved_chunks": chunks,
            "highlight_node_id": highlight_node_id,
            "code_ref": code_ref,
            "source_files": source_files
        }

    except Exception as e:
        return {
            "error": str(e),
            "answer": f"I encountered an error while searching the codebase: {str(e)}"
        }
