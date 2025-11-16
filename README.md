# Wikipedia Quiz Generator

An intelligent web application that automatically generates customized quizzes from Wikipedia articles using AI. The system scrapes Wikipedia content, processes it with Google's Gemini API, and stores quiz data in a MySQL database.

## Features

- **Wikipedia Article Scraping**: Automatically extracts content from Wikipedia articles
- **AI-Powered Quiz Generation**: Uses Google Gemini to create intelligent, contextual quiz questions
- **MySQL Database**: Persistent storage for quizzes, questions, and history
- **RESTful API**: FastAPI-based backend with full CORS support
- **Quiz History**: Track all generated quizzes with timestamps
- **Related Topics**: AI-generated list of related topics for each quiz
- **Difficulty Levels**: Questions categorized as easy, medium, or hard
- **Detailed Explanations**: Each question includes an explanation for the correct answer

## Project Structure

```
AI_WIKI/
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── requirements.txt         # Python dependencies
│   ├── myenv/                   # Virtual environment
│   └── test_gemini.py          # Gemini API testing
├── frontend/src                   # React frontend
└── README.md                    # This file
```

## Tech Stack

### Backend

- **Framework**: FastAPI 0.104.1
- **Server**: Uvicorn 0.24.0
- **Database**: MySQL with mysql-connector-python 8.2.0
- **API Integration**: Google Generative AI (Gemini)
- **Web Scraping**: BeautifulSoup4 4.12.2
- **HTTP Client**: Requests 2.31.0
- **Data Validation**: Pydantic 2.5.0
- **CORS**: fastapi.middleware.cors


## Installation

### 1. Clone/Navigate to Project

```powershell
cd backend
```

### 2. Create Virtual Environment

```powershell
python -m venv myenv
```

### 3. Activate Virtual Environment

```powershell
.\myenv\Scripts\Activate
```

### 4. Install Dependencies

```powershell
python -m pip install -r .\requirements.txt
```

### 5. Configure Database

Ensure MySQL is running and create a database user:

```sql
CREATE USER 'quiz_user'@'localhost' IDENTIFIED BY 'quiz_password_123';
CREATE DATABASE wiki_quiz_db;
GRANT ALL PRIVILEGES ON wiki_quiz_db.* TO 'quiz_user'@'localhost';
FLUSH PRIVILEGES;
```

**⚠️ Security**: Change the password in `main.py` before deploying to production.

### 6. Configure Gemini API

Update the API key in `main.py` (line 27):

```python
GEMINI_API_KEY = "YOUR_ACTUAL_API_KEY_HERE"
```

Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

## Running the Application

### Start Backend Server

```powershell
# Ensure venv is activated
.\myenv\Scripts\Activate.ps1

# Run the server
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Output:**

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [PID] using StatReload
```

**Access the API:**

- API Docs: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc
- Health Check: http://127.0.0.1:8000/

### Expose to LAN/External Access

```powershell
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

This makes the API accessible from other machines on your network at `http://YOUR_IP:8000`.

## API Endpoints

### 1. Health Check

**GET** `/`

```bash
curl http://127.0.0.1:8000/
```

**Response:**

```json
{
  "message": "Wikipedia Quiz Generator API",
  "status": "active"
}
```

### 2. Generate Quiz from Wikipedia URL

**POST** `/generate-quiz`

**Request Body:**

```json
{
  "url": "https://en.wikipedia.org/wiki/Artificial_intelligence"
}
```

**Response:**

```json
{
  "id": 1,
  "url": "https://en.wikipedia.org/wiki/Artificial_intelligence",
  "article_title": "Artificial intelligence",
  "article_summary": "Artificial intelligence (AI) is...",
  "questions": [
    {
      "question": "What does AI stand for?",
      "options": [
        "Artificial Intelligence",
        "Automated Interface",
        "Algorithm Implementation",
        "Automated Intelligence"
      ],
      "correct_answer": "A",
      "explanation": "AI stands for Artificial Intelligence...",
      "difficulty": "easy"
    }
  ],
  "related_topics": [
    "Machine Learning",
    "Deep Learning",
    "Neural Networks",
    "Natural Language Processing",
    "Computer Vision"
  ],
  "created_at": "2025-11-15T10:30:00.123456"
}
```

**Possible Errors:**

- `400 Bad Request`: Invalid Wikipedia URL or article too short
- `500 Internal Server Error`: Gemini API failure or database error

### 3. Get All Quizzes

**GET** `/quizzes`

**Response:**

```json
[
  {
    "id": 1,
    "url": "https://en.wikipedia.org/wiki/Artificial_intelligence",
    "article_title": "Artificial intelligence",
    "question_count": 7,
    "created_at": "2025-11-15T10:30:00.123456"
  }
]
```

### 4. Get Specific Quiz

**GET** `/quiz/{quiz_id}`

**Example:**

```bash
curl http://127.0.0.1:8000/quiz/1
```

**Response:** Returns full quiz object with all questions.

## Database Schema

### quizzes Table

```sql
CREATE TABLE quizzes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    url VARCHAR(500) NOT NULL,
    article_title VARCHAR(500) NOT NULL,
    article_summary TEXT,
    related_topics JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### questions Table

```sql
CREATE TABLE questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    question_text TEXT NOT NULL,
    options JSON NOT NULL,
    correct_answer VARCHAR(10) NOT NULL,
    explanation TEXT,
    difficulty VARCHAR(20),
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);
```

## Quiz Generation Logic

1. **Scrape Wikipedia**: Extract article title, summary, and main content
2. **Clean Content**: Remove citation markers, normalize whitespace
3. **Prompt Gemini**: Send cleaned content with detailed requirements
4. **Parse Response**: Extract and validate JSON quiz structure
5. **Save to DB**: Store quiz and questions with metadata
6. **Return Result**: Send complete quiz to client

### Quiz Requirements (Enforced by Gemini)

- Exactly 7 questions per quiz
- 4 options per question (A, B, C, D)
- Difficulty mix: 2-3 easy, 3-4 medium, 1-2 hard
- 1-2 sentence explanations
- 5 related topics

## Configuration

### DB_CONFIG (in main.py)

```python
DB_CONFIG = {
    'host': 'localhost',           # MySQL server address
    'user': 'quiz_user',           # Database user
    'password': 'quiz_password_123', # Database password (change this!)
    'database': 'wiki_quiz_db'     # Database name
}
```

### Error: "Invalid Wikipedia URL"

**Solution**: Ensure URL format is correct:

```
✓ https://en.wikipedia.org/wiki/Artificial_intelligence
✗ https://wikipedia.org/wiki/Artificial_intelligence (missing 'en')
✗ https://en.wikipedia.org/w/index.php?title=Artificial_intelligence
```

## Future Enhancements

- [ ] User authentication and quiz tracking
- [ ] Multi-language support
- [ ] Custom quiz length (not just 7 questions)
- [ ] Question filtering by difficulty
- [ ] Quiz sharing via unique links
- [ ] Analytics dashboard
- [ ] Export quizzes (PDF, CSV)
- [ ] Real-time quiz taking with scoring
- [ ] Custom Wikipedia sources/domains




