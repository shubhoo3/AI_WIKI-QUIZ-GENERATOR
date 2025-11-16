from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
import mysql.connector
from mysql.connector import Error
import requests
from bs4 import BeautifulSoup
import google.generativeai as genai
import json
from datetime import datetime
import re

# Initialize FastAPI
app = FastAPI(title="Wikipedia Quiz Generator API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini API
GEMINI_API_KEY = "AIzaSyB9HkbYE8gzUGkAmvZPRXBsDnnuWrHA37k"
genai.configure(api_key=GEMINI_API_KEY)

# MySQL Database Configuration
DB_CONFIG = {
    'host': 'localhost',
    'user': 'quiz_user',
    'password': 'quiz_password_123',  # Change this
    'database': 'wiki_quiz_db'
}

# Pydantic Models
class WikiURLRequest(BaseModel):
    url: str

class Question(BaseModel):
    question: str
    options: List[str]
    correct_answer: str
    explanation: str
    difficulty: str

class QuizResponse(BaseModel):
    id: int
    url: str
    article_title: str
    article_summary: str
    questions: List[Question]
    related_topics: List[str]
    created_at: str

class QuizHistoryItem(BaseModel):
    id: int
    url: str
    article_title: str
    question_count: int
    created_at: str

# Database Functions
def get_db_connection():
    """Create database connection"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

def init_database():
    """Initialize database and create tables"""
    try:
        connection = mysql.connector.connect(
            host=DB_CONFIG['host'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password']
        )
        cursor = connection.cursor()
        
        # Create database if not exists
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_CONFIG['database']}")
        cursor.execute(f"USE {DB_CONFIG['database']}")
        
        # Create quizzes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS quizzes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                url VARCHAR(500) NOT NULL,
                article_title VARCHAR(500) NOT NULL,
                article_summary TEXT,
                related_topics JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create questions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS questions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                quiz_id INT NOT NULL,
                question_text TEXT NOT NULL,
                options JSON NOT NULL,
                correct_answer VARCHAR(10) NOT NULL,
                explanation TEXT,
                difficulty VARCHAR(20),
                FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
            )
        """)
        
        connection.commit()
        cursor.close()
        connection.close()
        print("Database initialized successfully")
    except Error as e:
        print(f"Error initializing database: {e}")

# Scraping Functions
def scrape_wikipedia(url: str):
    """Scrape Wikipedia article content"""
    try:
        # Validate Wikipedia URL
        if 'wikipedia.org/wiki/' not in url:
            raise HTTPException(status_code=400, detail="Invalid Wikipedia URL")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Extract title
        title = soup.find('h1', class_='firstHeading')
        title_text = title.get_text() if title else "Unknown Article"
        
        # Extract main content
        content_div = soup.find('div', {'id': 'mw-content-text'})
        if not content_div:
            raise HTTPException(status_code=400, detail="Could not extract article content")
        
        # Get all paragraphs
        paragraphs = content_div.find_all('p')
        content = ' '.join([p.get_text() for p in paragraphs if p.get_text().strip()])
        
        # Clean content
        content = re.sub(r'\[\d+\]', '', content)  # Remove citation numbers
        content = re.sub(r'\s+', ' ', content).strip()  # Clean whitespace
        
        # Get first paragraph as summary
        summary = paragraphs[0].get_text() if paragraphs else content[:300]
        summary = re.sub(r'\[\d+\]', '', summary).strip()
        
        if len(content) < 100:
            raise HTTPException(status_code=400, detail="Article content too short")
        
        # Limit content length for API (keep first 8000 characters)
        content = content[:8000]
        
        return {
            'title': title_text,
            'summary': summary[:500],
            'content': content
        }
    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch Wikipedia article: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scraping error: {str(e)}")

# LLM Functions
def generate_quiz_with_gemini(article_data: dict):
    """Generate quiz using Gemini API"""
    try:
        # Initialize Gemini model
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = f"""Based on the following Wikipedia article about "{article_data['title']}", generate a quiz with 7 questions.

Article Content:
{article_data['content']}

Generate a quiz in JSON format with the following structure:
{{
    "questions": [
        {{
            "question": "Question text here?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": "A",
            "explanation": "Brief explanation of the correct answer",
            "difficulty": "easy/medium/hard"
        }}
    ],
    "related_topics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5"]
}}

Requirements:
- Generate exactly 7 questions
- Each question must have exactly 4 options
- Correct answer must be A, B, C, or D
- Mix difficulty levels (2-3 easy, 3-4 medium, 1-2 hard)
- Questions should cover different aspects of the article
- Explanations should be 1-2 sentences
- Related topics should be specific and relevant
- Return ONLY valid JSON, no additional text

Generate the quiz now:"""

        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Extract JSON from response
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            response_text = json_match.group()
        
        # Clean markdown code blocks if present
        response_text = re.sub(r'```json\s*|\s*```', '', response_text)
        
        quiz_data = json.loads(response_text)
        
        # Validate structure
        if 'questions' not in quiz_data:
            raise ValueError("No questions in response")
        
        # Normalize questions
        for q in quiz_data['questions']:
            if 'options' not in q or len(q['options']) != 4:
                raise ValueError("Invalid question format")
            q['correct_answer'] = q['correct_answer'].upper()
            if q['correct_answer'] not in ['A', 'B', 'C', 'D']:
                raise ValueError("Invalid correct answer")
        
        return quiz_data
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")
        print(f"Response: {response_text}")
        raise HTTPException(status_code=500, detail="Failed to parse LLM response")
    except Exception as e:
        print(f"Gemini API error: {e}")
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")

# Database Operations
def save_quiz_to_db(url: str, article_data: dict, quiz_data: dict):
    """Save quiz to database"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Insert quiz
        cursor.execute("""
            INSERT INTO quizzes (url, article_title, article_summary, related_topics)
            VALUES (%s, %s, %s, %s)
        """, (
            url,
            article_data['title'],
            article_data['summary'],
            json.dumps(quiz_data.get('related_topics', []))
        ))
        
        quiz_id = cursor.lastrowid
        
        # Insert questions
        for question in quiz_data['questions']:
            cursor.execute("""
                INSERT INTO questions (quiz_id, question_text, options, correct_answer, explanation, difficulty)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                quiz_id,
                question['question'],
                json.dumps(question['options']),
                question['correct_answer'],
                question['explanation'],
                question['difficulty']
            ))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return quiz_id
    except Error as e:
        print(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save quiz")

def get_quiz_from_db(quiz_id: int):
    """Retrieve quiz from database"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Get quiz info
        cursor.execute("SELECT * FROM quizzes WHERE id = %s", (quiz_id,))
        quiz = cursor.fetchone()
        
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")
        
        # Get questions
        cursor.execute("SELECT * FROM questions WHERE quiz_id = %s", (quiz_id,))
        questions = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        # Format response
        return {
            'id': quiz['id'],
            'url': quiz['url'],
            'article_title': quiz['article_title'],
            'article_summary': quiz['article_summary'],
            'questions': [
                {
                    'question': q['question_text'],
                    'options': json.loads(q['options']),
                    'correct_answer': q['correct_answer'],
                    'explanation': q['explanation'],
                    'difficulty': q['difficulty']
                }
                for q in questions
            ],
            'related_topics': json.loads(quiz['related_topics']),
            'created_at': quiz['created_at'].isoformat()
        }
    except Error as e:
        print(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve quiz")

def get_all_quizzes_from_db():
    """Get all quizzes from database"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT q.id, q.url, q.article_title, q.created_at, COUNT(qs.id) as question_count
            FROM quizzes q
            LEFT JOIN questions qs ON q.id = qs.quiz_id
            GROUP BY q.id
            ORDER BY q.created_at DESC
        """)
        
        quizzes = cursor.fetchall()
        cursor.close()
        connection.close()
        
        return [
            {
                'id': q['id'],
                'url': q['url'],
                'article_title': q['article_title'],
                'question_count': q['question_count'],
                'created_at': q['created_at'].isoformat()
            }
            for q in quizzes
        ]
    except Error as e:
        print(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve quizzes")

# API Endpoints
@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_database()

@app.get("/")
async def root():
    return {"message": "Wikipedia Quiz Generator API", "status": "active"}

@app.post("/generate-quiz", response_model=QuizResponse)
async def generate_quiz(request: WikiURLRequest):
    """Generate a quiz from Wikipedia URL"""
    try:
        # Scrape Wikipedia article
        article_data = scrape_wikipedia(request.url)
        
        # Generate quiz using Gemini
        quiz_data = generate_quiz_with_gemini(article_data)
        
        # Save to database
        quiz_id = save_quiz_to_db(request.url, article_data, quiz_data)
        
        # Return response
        return {
            'id': quiz_id,
            'url': request.url,
            'article_title': article_data['title'],
            'article_summary': article_data['summary'],
            'questions': quiz_data['questions'],
            'related_topics': quiz_data.get('related_topics', []),
            'created_at': datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/quizzes", response_model=List[QuizHistoryItem])
async def get_quizzes():
    """Get all quizzes"""
    return get_all_quizzes_from_db()

@app.get("/quiz/{quiz_id}", response_model=QuizResponse)
async def get_quiz(quiz_id: int):
    """Get specific quiz by ID"""
    return get_quiz_from_db(quiz_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)