import { useEffect, useState } from "react";
import { MessageSquare, Star, User, Mail } from "lucide-react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { format } from "date-fns";

export default function Feedback() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | positive | negative

  useEffect(() => {
    loadFeedbacks();
  }, []);

  async function loadFeedbacks() {
    setLoading(true);
    try {
      let snap;
      try {
        snap = await getDocs(
          query(collection(db, "feedbacks"), orderBy("createdAt", "desc"))
        );
      } catch {
        snap = await getDocs(collection(db, "feedbacks"));
      }
      setFeedbacks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Failed to load feedbacks:", err);
    } finally {
      setLoading(false);
    }
  }

  // Stats
  const total = feedbacks.length;
  const avgRating =
    total > 0
      ? feedbacks.reduce((sum, f) => sum + (f.rating || 0), 0) / total
      : 0;
  const positiveCount = feedbacks.filter((f) => (f.rating || 0) >= 4).length;
  const negativeCount = feedbacks.filter((f) => (f.rating || 0) <= 2).length;

  const filtered = feedbacks.filter((f) => {
    if (filter === "positive") return (f.rating || 0) >= 4;
    if (filter === "negative") return (f.rating || 0) <= 2;
    return true;
  });

  // Distribution: count how many feedbacks at each star rating (1-5)
  const distribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: feedbacks.filter((f) => f.rating === rating).length,
    pct: total > 0
      ? (feedbacks.filter((f) => f.rating === rating).length / total) * 100
      : 0,
  }));

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="text-redcross-500" size={28} />
          Patient Feedback
        </h1>
        <p className="text-gray-600 mt-1">
          Ratings and comments from patients about Red Cross services.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500 mb-1">Average Rating</div>
          <div className="flex items-baseline gap-2">
            <div className="text-4xl font-bold text-gray-900">
              {avgRating.toFixed(1)}
            </div>
            <div className="text-gray-500">/ 5</div>
          </div>
          <div className="flex items-center gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={16}
                className={
                  n <= Math.round(avgRating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-gray-300"
                }
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500">Total Reviews</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{total}</div>
          <div className="text-xs text-gray-500 mt-1">From patients</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500">Sentiment</div>
          <div className="flex items-center gap-3 mt-1">
            <div className="text-2xl font-bold text-green-600">
              {positiveCount} 👍
            </div>
            <div className="text-2xl font-bold text-red-500">
              {negativeCount} 👎
            </div>
          </div>
        </div>
      </div>

      {/* Distribution chart */}
      {total > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Rating Distribution
          </h3>
          <div className="space-y-2">
            {distribution
              .slice()
              .reverse()
              .map((d) => (
                <div key={d.rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-16">
                    <span className="text-sm font-medium">{d.rating}</span>
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-400 h-full transition-all"
                      style={{ width: `${d.pct}%` }}
                    />
                  </div>
                  <div className="w-12 text-right text-sm text-gray-600">
                    {d.count}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="bg-white rounded-xl border border-gray-200 p-2 mb-4 inline-flex gap-1">
        <FilterTab label="All" value="all" current={filter} onClick={setFilter} count={total} />
        <FilterTab label="Positive (4-5★)" value="positive" current={filter} onClick={setFilter} count={positiveCount} />
        <FilterTab label="Negative (1-2★)" value="negative" current={filter} onClick={setFilter} count={negativeCount} />
      </div>

      {/* Feedback list */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          Loading feedback...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <MessageSquare className="mx-auto mb-3" size={40} />
          <p className="font-medium text-gray-600">No feedback to show</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => (
            <FeedbackCard key={f.id} feedback={f} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterTab({ label, value, current, onClick, count }) {
  const isActive = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? "bg-redcross-500 text-white"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {label}
      <span
        className={`text-xs ml-1 ${
          isActive ? "text-white/80" : "text-gray-400"
        }`}
      >
        ({count})
      </span>
    </button>
  );
}

function FeedbackCard({ feedback }) {
  const time = feedback.createdAt?.toDate
    ? format(feedback.createdAt.toDate(), "MMM d, yyyy 'at' h:mm a")
    : "—";
  const rating = feedback.rating || 0;

  // Border color based on sentiment
  let borderClass = "border-gray-200";
  if (rating >= 4) borderClass = "border-green-300";
  else if (rating <= 2) borderClass = "border-red-300";

  return (
    <div className={`bg-white rounded-xl border-2 ${borderClass} p-5`}>
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-redcross-100 text-redcross-600 flex items-center justify-center font-semibold flex-shrink-0">
          {(feedback.patientName || feedback.patientEmail || "?")
            .charAt(0)
            .toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <div className="font-semibold text-gray-900 flex items-center gap-2">
                <User size={14} className="text-gray-400" />
                {feedback.patientName || "Anonymous"}
              </div>
              {feedback.patientEmail && (
                <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <Mail size={11} />
                  {feedback.patientEmail}
                </div>
              )}
            </div>

            {/* Star rating */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={16}
                  className={
                    n <= rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-gray-300"
                  }
                />
              ))}
            </div>
          </div>

          {feedback.comment ? (
            <p className="text-gray-700 mb-2 whitespace-pre-wrap">
              "{feedback.comment}"
            </p>
          ) : (
            <p className="text-gray-400 italic mb-2">
              (No comment, rating only)
            </p>
          )}

          <div className="text-xs text-gray-400">{time}</div>
        </div>
      </div>
    </div>
  );
}