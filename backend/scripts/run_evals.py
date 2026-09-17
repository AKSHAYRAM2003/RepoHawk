#!/usr/bin/env python3
"""
RAG Evaluation Script

This script uses LangSmith's 'LLM-as-a-judge' evaluation framework to test the 
RepoHawk Q&A pipeline for Context Relevance and Hallucination.
"""

import os
import uuid
import sys
import logging
from typing import Dict, Any

# Ensure backend root is in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from langsmith import Client, evaluate
from langchain_core.messages import SystemMessage, HumanMessage
from app.core.llm import get_chat_llm
from app.agents.nodes.qa_agent import qa_agent_node

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rag_evals")

client = Client()

# Mock dataset for evaluation
EVAL_DATASET = [
    {
        "question": "What database does this repository use?",
        "expected_answer": "PostgreSQL, accessed via SQLAlchemy.",
        "repo_id": "00000000-0000-0000-0000-000000000001",
    },
    {
        "question": "How is the AST parsing implemented?",
        "expected_answer": "It uses tree-sitter to parse the code into an Abstract Syntax Tree.",
        "repo_id": "00000000-0000-0000-0000-000000000001",
    }
]

def qa_pipeline_target(inputs: dict) -> dict:
    """The function that we are evaluating."""
    # We call the QA LangGraph node directly.
    # Note: For this mock script, the repo_id needs to point to an actual embedded repo
    # in ChromaDB, otherwise it will just return "not found".
    state = {
        "question": inputs["question"],
        "repo_id": inputs["repo_id"],
        "chat_history": [],
        "valid_node_ids": []
    }
    result = qa_agent_node(state)
    return {"answer": result.get("answer", "")}

def faithfulness_evaluator(run: Any, example: Any) -> dict:
    """
    LLM-as-a-judge evaluator.
    Checks if the generated answer is faithful to the retrieved context (no hallucinations).
    """
    llm = get_chat_llm()
    system_prompt = """You are an expert evaluator. 
    Look at the answer provided by the AI. Is the answer faithful to the expected answer?
    Output exactly 'SCORE: 1' if faithful, or 'SCORE: 0' if it contains hallucinations or contradictions.
    """
    
    question = example.inputs["question"]
    expected = example.outputs["expected_answer"]
    actual = run.outputs["answer"]
    
    prompt = f"Question: {question}\nExpected: {expected}\nActual: {actual}"
    
    response = llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=prompt)
    ])
    
    content = getattr(response, "content", "")
    score = 1.0 if "SCORE: 1" in content else 0.0
    
    return {"key": "faithfulness", "score": score}

def run_evaluations():
    """Create a dataset in LangSmith and run the evaluations."""
    dataset_name = f"RepoHawk-QA-Evals-{uuid.uuid4().hex[:6]}"
    logger.info(f"Creating LangSmith dataset: {dataset_name}")
    
    dataset = client.create_dataset(dataset_name=dataset_name, description="RAG Q&A Evals")
    for data in EVAL_DATASET:
        client.create_example(
            inputs={"question": data["question"], "repo_id": data["repo_id"]},
            outputs={"expected_answer": data["expected_answer"]},
            dataset_id=dataset.id,
        )
    
    logger.info("Running evaluation... (Check LangSmith UI for real-time results)")
    results = evaluate(
        qa_pipeline_target,
        data=dataset_name,
        evaluators=[faithfulness_evaluator],
        experiment_prefix="RAG-Faithfulness-Test",
    )
    logger.info("Evaluation complete!")
    return results

if __name__ == "__main__":
    if not os.environ.get("LANGCHAIN_API_KEY"):
        logger.error("LANGCHAIN_API_KEY is not set. LangSmith evals require an API key.")
        sys.exit(1)
        
    logger.info("Starting RAG Evaluations...")
    run_evaluations()
