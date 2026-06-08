# Evaluation Suite — CareerPilot
 
This document presents the programmatic evaluation results for CareerPilot's Fit Score Algorithm against the 5 canonical test cases specified in the Product Requirements Document (PRD).

---

## 📊 Summary Table

| Test ID | Scenario | Expected Range | Actual Score | Verdict |
|---------|----------|----------------|--------------|---------|
| TC_01 | Python ML Engineer Match | 70%–85% | **72%** | ✅ PASS |
| TC_02 | Fresh Graduate Mismatch | 55%–65% | **61%** | ✅ PASS |
| TC_03 | Full-Stack Dev Partial Match | 60%–75% | **66%** | ✅ PASS |
| TC_04 | Data Analyst Partial Match | 60%–75% | **66%** | ✅ PASS |
| TC_05 | DevOps Engineer Partial Match | 55%–65% | **61%** | ✅ PASS |

---

## 📝 Detailed Test Cases

### TC_01 — Python ML Engineer Match
- **Scenario**: Python ML engineer with 3 years experience matching an ML Engineer role
- **Job Description Excerpt**: *"Machine Learning Engineer role requiring Python, TensorFlow, and PyTorch. Build and optimize model pipelines."*
- **Expected Score Range**: 70%–85%
- **Programmatic Fit Score**: **72%**
- **Verdict**: ✅ PASS
- **Gemini Explanation**:
  > "The candidate's strong match in Python, TensorFlow, and PyTorch, coupled with relevant experience in building and optimizing model pipelines, justifies a good fit score, though minor gaps might exist in areas not explicitly detailed or in specific optimization techniques."

---
### TC_02 — Fresh Graduate Mismatch
- **Scenario**: Fresh graduate with no experience matching a Senior backend role
- **Job Description Excerpt**: *"Senior Backend Engineer. Minimum 5 years of experience building scalable enterprise services in Python/FastAPI. Kubernetes and Docker required."*
- **Expected Score Range**: 55%–65%
- **Programmatic Fit Score**: **61%**
- **Verdict**: ✅ PASS
- **Gemini Explanation**:
  > "While the candidate possesses a relevant degree and some Python project experience, the complete lack of professional experience building scalable enterprise services and familiarity with required technologies like Kubernetes and Docker creates a significant gap, justifying a moderate fit score."

---
### TC_03 — Full-Stack Dev Partial Match
- **Scenario**: Full-stack React/Node dev matching a Frontend React engineer role
- **Job Description Excerpt**: *"Frontend React Engineer. Build beautiful, high-performance web applications using React, TypeScript, and modern state management."*
- **Expected Score Range**: 60%–75%
- **Programmatic Fit Score**: **66%**
- **Verdict**: ✅ PASS
- **Gemini Explanation**:
  > "The candidate has a strong foundation in React and TypeScript, aligning well with the job description, but their limited experience specifically in "high-performance" and "modern state management" (beyond Redux) likely contributes to the moderate score."

---
### TC_04 — Data Analyst Partial Match
- **Scenario**: Data analyst (SQL/Excel) matching a Data engineer (Spark) role
- **Job Description Excerpt**: *"Data Engineer. Build robust ETL pipelines using Apache Spark, Python, and SQL. Manage data warehousing on AWS."*
- **Expected Score Range**: 60%–75%
- **Programmatic Fit Score**: **66%**
- **Verdict**: ✅ PASS
- **Gemini Explanation**:
  > "The candidate possesses foundational SQL and Python skills and has relevant data analysis experience, but lacks direct experience with Apache Spark and AWS data warehousing, leading to a moderate fit score."

---
### TC_05 — DevOps Engineer Partial Match
- **Scenario**: DevOps engineer matching a Backend Python engineer role
- **Job Description Excerpt**: *"Backend Python Engineer. Develop REST APIs using Python, FastAPI, and PostgreSQL. Design clean database schemas and write optimized queries."*
- **Expected Score Range**: 55%–65%
- **Programmatic Fit Score**: **61%**
- **Verdict**: ✅ PASS
- **Gemini Explanation**:
  > "While the candidate possesses strong DevOps and automation skills that align with backend infrastructure, their CV lacks direct evidence of developing REST APIs with Python, FastAPI, and PostgreSQL, indicating a significant gap in core backend development experience despite a respectable overall fit."

---
