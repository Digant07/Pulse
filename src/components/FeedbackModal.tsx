import React, { useState } from 'react';
import { X, Send, CheckCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus('submitting');

    // Simulate API request
    setTimeout(() => {
      setStatus('success');
      
      // Trigger small confetti burst
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#0072f5', '#00dfd8', '#00e676']
      });
    }, 1200);
  };

  const handleReset = () => {
    setRating(null);
    setCategory('general');
    setMessage('');
    setStatus('idle');
    onClose();
  };

  const emojis = ['😠', '🙁', '😐', '🙂', '😍'];

  return (
    <div className="modal-overlay" onClick={handleReset}>
      <div className="modal-card feedback-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div className="modal-title-group">
            <Send size={18} className="text-accent-cyan" />
            <h2 className="modal-title">Share Your Feedback</h2>
          </div>
          <button className="modal-close-btn" onClick={handleReset}>
            <X size={18} />
          </button>
        </header>

        {status !== 'success' ? (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">How is your experience with Pluse?</label>
                <div className="emoji-rating-group">
                  {emojis.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`emoji-btn ${rating === idx ? 'active' : ''}`}
                      onClick={() => setRating(idx)}
                      disabled={status === 'submitting'}
                    >
                      <span className="emoji-face">{emoji}</span>
                      <span className="emoji-label">
                        {idx === 0 ? 'Bad' : idx === 2 ? 'Neutral' : idx === 4 ? 'Love it!' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="select-box"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={status === 'submitting'}
                >
                  <option value="general">General Feedback</option>
                  <option value="bug">Bug Report</option>
                  <option value="feature">Feature Request</option>
                  <option value="performance">Performance Issue</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">What can we improve?</label>
                <textarea
                  className="textarea-box"
                  placeholder="Share your thoughts, suggestions, or describe a bug..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  disabled={status === 'submitting'}
                  rows={4}
                />
              </div>
            </div>

            <footer className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: 'auto' }}
                onClick={handleReset}
                disabled={status === 'submitting'}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-github"
                style={{ width: 'auto', background: '#fff', color: '#000' }}
                disabled={status === 'submitting' || !message.trim()}
              >
                {status === 'submitting' ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </footer>
          </form>
        ) : (
          <div className="feedback-success-state">
            <div className="success-icon-wrapper">
              <CheckCircle size={44} className="text-status-ready" />
            </div>
            <h3>Thank You!</h3>
            <p>
              Your feedback has been recorded successfully. We appreciate your inputs to help make Pluse a better edge application deployment portal.
            </p>
            <button className="btn btn-github" style={{ marginTop: '16px' }} onClick={handleReset}>
              Return to App
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
