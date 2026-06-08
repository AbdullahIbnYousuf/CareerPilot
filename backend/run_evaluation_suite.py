import asyncio
import os
import sys
import json
import numpy as np
from pathlib import Path
from dotenv import load_dotenv

# Set PYTHONPATH and load dotenv
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from services.embedder import embed_query, embed_documents
from services.parser import generate_content_with_fallback
from services.fit_score import (
    SECTION_WEIGHTS, 
    _cosine, 
    _role_relevance_multiplier, 
    _build_explanation_prompt,
    _fallback_explanation
)

# Define the 5 evaluation cases from the PRD
EVAL_CASES = [
    {
        "test_id": "TC_01",
        "name": "Python ML Engineer Match",
        "description": "Python ML engineer with 3 years experience matching an ML Engineer role",
        "cv": {
            "skills": "Python, PyTorch, TensorFlow, Keras, Scikit-Learn, Git, Docker",
            "experience": "Machine Learning Engineer at Tech Solutions (3 years). Built and deployed deep learning models using TensorFlow. Optimized PyTorch training pipelines.",
            "education": "MSc in Data Science, BSc in Computer Science",
            "projects": "Custom neural network implementation for image recognition"
        },
        "jd": "Machine Learning Engineer role requiring Python, TensorFlow, and PyTorch. Build and optimize model pipelines.",
        "search_query": "Machine Learning Engineer",
        "expected_min": 70,
        "expected_max": 85
    },
    {
        "test_id": "TC_02",
        "name": "Fresh Graduate Mismatch",
        "description": "Fresh graduate with no experience matching a Senior backend role",
        "cv": {
            "skills": "Python, Java, Basic HTML/CSS",
            "experience": "No professional experience.",
            "education": "BSc in Computer Science, fresh graduate.",
            "projects": "Simple calculator app in Python, personal portfolio website."
        },
        "jd": "Senior Backend Engineer. Minimum 5 years of experience building scalable enterprise services in Python/FastAPI. Kubernetes and Docker required.",
        "search_query": "Senior Backend Engineer",
        "expected_min": 55,
        "expected_max": 65
    },
    {
        "test_id": "TC_03",
        "name": "Full-Stack Dev Partial Match",
        "description": "Full-stack React/Node dev matching a Frontend React engineer role",
        "cv": {
            "skills": "JavaScript, TypeScript, React, HTML5, CSS3, Node.js, Express, MongoDB",
            "experience": "Full Stack Developer (2 years). Designed React user interfaces, managed state with Redux, built Node.js REST APIs.",
            "education": "BSc in Software Engineering",
            "projects": "E-commerce platform using React, Node.js, and MongoDB."
        },
        "jd": "Frontend React Engineer. Build beautiful, high-performance web applications using React, TypeScript, and modern state management.",
        "search_query": "Frontend React Engineer",
        "expected_min": 60,
        "expected_max": 75
    },
    {
        "test_id": "TC_04",
        "name": "Data Analyst Partial Match",
        "description": "Data analyst (SQL/Excel) matching a Data engineer (Spark) role",
        "cv": {
            "skills": "SQL, Excel, Tableau, PowerBI, Python (Pandas)",
            "experience": "Data Analyst (2 years). Wrote complex SQL queries, generated weekly business reports, designed Tableau dashboards.",
            "education": "BSc in Business Information Systems",
            "projects": "Sales data analysis dashboard with SQL and Tableau."
        },
        "jd": "Data Engineer. Build robust ETL pipelines using Apache Spark, Python, and SQL. Manage data warehousing on AWS.",
        "search_query": "Data Engineer",
        "expected_min": 60,
        "expected_max": 75
    },
    {
        "test_id": "TC_05",
        "name": "DevOps Engineer Partial Match",
        "description": "DevOps engineer matching a Backend Python engineer role",
        "cv": {
            "skills": "AWS, Docker, Kubernetes, Terraform, CI/CD, Bash scripting, Python (scripting)",
            "experience": "DevOps Engineer (3 years). Automated deployments on AWS with Terraform. Configured Docker containers and Kubernetes clusters.",
            "education": "BSc in Computer Engineering",
            "projects": "Automated CI/CD deployment pipeline for a microservice app."
        },
        "jd": "Backend Python Engineer. Develop REST APIs using Python, FastAPI, and PostgreSQL. Design clean database schemas and write optimized queries.",
        "search_query": "Backend Python Engineer",
        "expected_min": 55,
        "expected_max": 65
    }
]

async def run_evaluation():
    print("=" * 80)
    print("RUNNING CAREERPILOT EVALUATION SUITE")
    print("=" * 80)
    
    results = []
    
    for case in EVAL_CASES:
        print(f"\nProcessing {case['test_id']}: {case['name']}...")
        
        # 1. Embed job description
        jd_embedding = embed_query(case["jd"])
        
        # 2. Embed each CV section
        section_scores = {}
        evidence_snippets = []
        
        for section, weight in SECTION_WEIGHTS.items():
            content = case["cv"].get(section, "").strip()
            if not content:
                section_scores[section] = 0.0
                continue
                
            # Embed CV content
            cv_embeddings = embed_documents([content])
            if not cv_embeddings:
                section_scores[section] = 0.0
                continue
                
            sim = _cosine(jd_embedding, cv_embeddings[0])
            section_scores[section] = float(sim)
            evidence_snippets.append(f"[{section}] {content[:150]}...")
            
        # 3. Compute weighted average
        weighted_score = sum(
            section_scores.get(section, 0.0) * weight
            for section, weight in SECTION_WEIGHTS.items()
        )
        
        # 4. Multiply by role relevance multiplier
        role_multiplier = _role_relevance_multiplier(case["search_query"], case["jd"])
        score_int = min(100, max(0, round(weighted_score * role_multiplier * 100)))
        
        # 5. Generate LLM explanation using Gemini fallback loop
        explanation = _fallback_explanation(score_int)
        try:
            prompt = _build_explanation_prompt(case["jd"], score_int, evidence_snippets)
            response = generate_content_with_fallback(prompt)
            explanation = (response.text or "").strip() or explanation
        except Exception as e:
            print(f"  [Warning] Explanation generation failed: {e}. Using fallback.")
            
        # 6. Check pass condition
        is_pass = case["expected_min"] <= score_int <= case["expected_max"]
        verdict = "PASS" if is_pass else "FAIL"
        
        print(f"  Result Score: {score_int}% (Expected: {case['expected_min']}-{case['expected_max']}%)")
        print(f"  Verdict: {verdict}")
        print(f"  Explanation: {explanation}")
        
        results.append({
            "test_id": case["test_id"],
            "name": case["name"],
            "description": case["description"],
            "jd": case["jd"],
            "expected_range": f"{case['expected_min']}%–{case['expected_max']}%",
            "score": score_int,
            "explanation": explanation,
            "verdict": verdict
        })
        
    # Write to evaluation_suite.json
    json_path = Path(__file__).parent.parent / "evaluation_suite.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\n[OK] Updated: {json_path}")
    
    # Write to eval.md (as required by PRD and Day 12 deliverable)
    md_path = Path(__file__).parent.parent / "eval.md"
    
    md_content = f"""# Evaluation Suite — CareerPilot
 
This document presents the programmatic evaluation results for CareerPilot's Fit Score Algorithm against the 5 canonical test cases specified in the Product Requirements Document (PRD).

---

## 📊 Summary Table

| Test ID | Scenario | Expected Range | Actual Score | Verdict |
|---------|----------|----------------|--------------|---------|
"""
    
    for r in results:
        md_content += f"| {r['test_id']} | {r['name']} | {r['expected_range']} | **{r['score']}%** | {r['verdict'] == 'PASS' and '✅ PASS' or '❌ FAIL'} |\n"
        
    md_content += "\n---\n\n## 📝 Detailed Test Cases\n\n"
    
    for r in results:
        md_content += f"""### {r['test_id']} — {r['name']}
- **Scenario**: {r['description']}
- **Job Description Excerpt**: *"{r['jd']}"*
- **Expected Score Range**: {r['expected_range']}
- **Programmatic Fit Score**: **{r['score']}%**
- **Verdict**: {r['verdict'] == 'PASS' and '✅ PASS' or '❌ FAIL'}
- **Gemini Explanation**:
  > "{r['explanation']}"

---
"""
        
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    print(f"[OK] Created: {md_path}")

if __name__ == "__main__":
    asyncio.run(run_evaluation())
