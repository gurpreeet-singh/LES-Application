import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-2xl text-center px-6">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Learning Execution System
        </h1>
        <p className="text-lg text-gray-600 mb-2">
          A cognitive operating system for learning
        </p>
        <p className="text-sm text-gray-500 mb-8">
          Replace marks-based evaluation with deep conceptual mastery tracking.
          Upload any syllabus — AI generates knowledge graphs, lesson plans, Socratic scripts, and diagnostic quizzes.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/signup" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700">
            Get Started
          </Link>
          <Link to="/login" className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:border-gray-400">
            Sign In
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-8">
          La Martiniere College | Built by Nandan Mishra & Abhay Pandey
        </p>
      </div>
    </div>
  );
}
