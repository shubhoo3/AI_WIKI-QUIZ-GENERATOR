import React, { useState, useEffect } from 'react';
import { BookOpen, Clock, History, ExternalLink, Loader2, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import './App.css';

const API_URL = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('generate');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [quizMode, setQuizMode] = useState(false);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/quizzes`);
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const generateQuiz = async () => {
    if (!url.trim()) {
      setError('Please enter a Wikipedia URL');
      return;
    }

    setLoading(true);
    setError('');
    setQuizData(null);

    try {
      const response = await fetch(`${API_URL}/generate-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate quiz');
      }

      const data = await response.json();
      setQuizData(data);
      setQuizMode(false);
      setUserAnswers({});
      setShowResults(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const viewQuizDetails = async (quizId) => {
    try {
      const response = await fetch(`${API_URL}/quiz/${quizId}`);
      const data = await response.json();
      setSelectedQuiz(data);
      setQuizMode(false);
      setUserAnswers({});
      setShowResults(false);
    } catch (err) {
      console.error('Error fetching quiz details:', err);
    }
  };

  const handleAnswerSelect = (questionIndex, option) => {
    if (!showResults) {
      setUserAnswers({ ...userAnswers, [questionIndex]: option });
    }
  };

  const submitQuiz = () => {
    setShowResults(true);
  };

  const calculateScore = () => {
    const questions = quizMode ? (selectedQuiz || quizData).questions : [];
    const correct = questions.filter((q, idx) => userAnswers[idx] === q.correct_answer).length;
    return { correct, total: questions.length };
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-50 text-red-800'
    };
    return colors[difficulty] || colors.medium;
  };

  const QuizDisplay = ({ data, isQuizMode = false }) => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">{data.article_title}</h2>
            <p className="text-blue-100 mb-4">{data.article_summary}</p>
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
            >
              <ExternalLink className="w-4 h-4" />
              View Wikipedia Article
            </a>
          </div>
        </div>
      </div>

      {isQuizMode && showResults && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-xl p-6">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Quiz Complete!</h3>
            <p className="text-4xl font-bold text-green-600">
              {calculateScore().correct} / {calculateScore().total}
            </p>
            <p className="text-gray-600 mt-2">
              {Math.round((calculateScore().correct / calculateScore().total) * 100)}% Correct
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {data.questions.map((q, idx) => (
          <div key={idx} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-all">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-500">Question {idx + 1}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getDifficultyColor(q.difficulty)}`}>
                  {q.difficulty.toUpperCase()}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800">{q.question}</h3>
            </div>

            <div className="p-6 space-y-3">
              {q.options.map((option, optIdx) => {
                const optionLetter = String.fromCharCode(65 + optIdx);
                const isSelected = userAnswers[idx] === optionLetter;
                const isCorrect = optionLetter === q.correct_answer;
                const showCorrect = showResults && isCorrect;
                const showIncorrect = showResults && isSelected && !isCorrect;

                let buttonClass = 'w-full text-left px-4 py-3 rounded-lg border-2 transition-all ';
                if (showCorrect) {
                  buttonClass += 'bg-green-50 border-green-500 text-green-800';
                } else if (showIncorrect) {
                  buttonClass += 'bg-red-50 border-red-500 text-red-800';
                } else if (isSelected && !showResults) {
                  buttonClass += 'bg-blue-50 border-blue-500 text-blue-800';
                } else if (!isQuizMode) {
                  buttonClass += isCorrect
                    ? 'bg-green-50 border-green-500 text-green-800'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50';
                } else {
                  buttonClass += 'border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50';
                }

                return (
                  <button
                    key={optIdx}
                    onClick={() => isQuizMode && handleAnswerSelect(idx, optionLetter)}
                    disabled={!isQuizMode || showResults}
                    className={buttonClass}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm">{optionLetter}.</span>
                        <span>{option}</span>
                      </div>
                      {showCorrect && <CheckCircle className="w-5 h-5 text-green-600" />}
                      {showIncorrect && <XCircle className="w-5 h-5 text-red-600" />}
                      {!isQuizMode && isCorrect && <CheckCircle className="w-5 h-5 text-green-600" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {(!isQuizMode || showResults) && (
              <div className="px-6 pb-6">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                  <p className="text-sm font-semibold text-blue-800 mb-1">Explanation:</p>
                  <p className="text-sm text-blue-900">{q.explanation}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {isQuizMode && !showResults && (
        <button
          onClick={submitQuiz}
          disabled={Object.keys(userAnswers).length !== data.questions.length}
          className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 rounded-xl font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
        >
          Submit Quiz
        </button>
      )}

      {data.related_topics && data.related_topics.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-600" />
            Related Topics
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.related_topics.map((topic, idx) => (
              <span
                key={idx}
                className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors cursor-pointer"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-6xl" style={{ margin: '0 auto', padding: '1rem' }}>
        <div className="text-center mb-8 mt-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)' }}>
            Wikipedia Quiz Generator
          </h1>
          <p className="text-gray-600 text-lg">Transform any Wikipedia article into an interactive quiz</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('generate')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'generate'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BookOpen className="w-5 h-5" />
              Generate Quiz
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <History className="w-5 h-5" />
              Past Quizzes
            </button>
          </div>

          <div className="p-6" style={{ padding: 'clamp(1.5rem, 4vw, 2rem)' }}>
            {activeTab === 'generate' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Wikipedia Article URL
                  </label>
                  <div className="flex gap-3" style={{ flexDirection: window.innerWidth < 640 ? 'column' : 'row' }}>
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://en.wikipedia.org/wiki/Alan_Turing"
                      className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                      disabled={loading}
                    />
                    <button
                      onClick={generateQuiz}
                      disabled={loading}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center gap-2 whitespace-nowrap"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <ChevronRight className="w-5 h-5" />
                          Generate
                        </>
                      )}
                    </button>
                  </div>
                  {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                      <p className="text-red-800 text-sm">{error}</p>
                    </div>
                  )}
                </div>

                {quizData && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-gray-800">Your Quiz is Ready!</h2>
                      <button
                        onClick={() => {
                          setQuizMode(!quizMode);
                          setUserAnswers({});
                          setShowResults(false);
                        }}
                        className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                          quizMode
                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            : 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md'
                        }`}
                      >
                        {quizMode ? 'View Answers' : 'Take Quiz'}
                      </button>
                    </div>
                    <QuizDisplay data={quizData} isQuizMode={quizMode} />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Clock className="w-6 h-6 text-blue-600" />
                  Quiz History
                </h2>

                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-16 h-16 text-gray-300 mx-auto mb-4" style={{ margin: '0 auto 1rem' }} />
                    <p className="text-gray-500 text-lg">No quizzes generated yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b-2 border-gray-200">
                            Article Title
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b-2 border-gray-200">
                            Questions
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b-2 border-gray-200">
                            Created
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 border-b-2 border-gray-200">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((quiz) => (
                          <tr key={quiz.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-800">{quiz.article_title}</div>
                              <div className="text-sm text-gray-500 truncate" style={{ maxWidth: '28rem' }}>{quiz.url}</div>
                            </td>
                            <td className="px-6 py-4 text-gray-700">{quiz.question_count}</td>
                            <td className="px-6 py-4 text-gray-700 text-sm">
                              {new Date(quiz.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => viewQuizDetails(quiz.id)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedQuiz && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 overflow-y-auto" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-800">Quiz Details</h2>
              <button
                onClick={() => {
                  setSelectedQuiz(null);
                  setQuizMode(false);
                  setUserAnswers({});
                  setShowResults(false);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Close
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6 flex items-center justify-end">
                <button
                  onClick={() => {
                    setQuizMode(!quizMode);
                    setUserAnswers({});
                    setShowResults(false);
                  }}
                  className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                    quizMode
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      : 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md'
                  }`}
                >
                  {quizMode ? 'View Answers' : 'Take Quiz'}
                </button>
              </div>
              <QuizDisplay data={selectedQuiz} isQuizMode={quizMode} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;