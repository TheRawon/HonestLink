/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  updateDoc,
  setDoc,
  doc,
  increment,
  where,
  limit,
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import {
  Briefcase,
  MessageCircle,
  Flame,
  TrendingUp,
  LogOut,
  Search,
  BarChart,
  Heart,
  Share2,
  AlertCircle,
  ThumbsDown,
  Menu,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { formatDistanceToNow } from 'date-fns';

type PostType = 'rant' | 'tip' | 'interview' | 'review' | 'salary';
type AuthMode = 'firebase' | 'demo' | null;

interface PostComment {
  id: string;
  userName: string;
  text: string;
  createdAt: number;
  replies?: PostReply[];
}

interface PostReply {
  id: string;
  userName: string;
  text: string;
  createdAt: number;
}

interface AppUser {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string | null;
  isDemo?: boolean;
}

interface HonestPost {
  id: string;
  userId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  type: PostType;
  companyName?: string;
  likesCount: number;
  dislikesCount?: number;
  createdAt: any;
  comments?: PostComment[];
  likedByUserIds?: string[];
  dislikedByUserIds?: string[];
}

const DEMO_USER_KEY = 'honestlink-demo-user';
const DEMO_DEVICE_ID_KEY = 'honestlink-demo-device-id';
const DEMO_POSTS_KEY = 'honestlink-demo-posts';
const LIKED_POSTS_KEY = 'honestlink-liked-posts';
const DISLIKED_POSTS_KEY = 'honestlink-disliked-posts';
const LOCAL_COMMENTS_KEY = 'honestlink-local-comments';
const DEMO_OPT_IN_KEY = 'honestlink-demo-opt-in';
const DEMO_AVATAR = 'https://api.dicebear.com/9.x/shapes/svg?seed=HonestLink';

const demoSeedPosts: HonestPost[] = [
  {
    id: 'demo-1',
    userId: 'demo-system',
    authorName: 'HonestLink Demo',
    authorPhoto: DEMO_AVATAR,
    content: 'Welcome to demo mode. Google login fail ho to bhi aap app use kar sakte ho, post kar sakte ho, aur UI test kar sakte ho.',
    type: 'tip',
    likesCount: 0,
    dislikesCount: 0,
    createdAt: Date.now() - 1000 * 60 * 12,
    comments: [],
    likedByUserIds: [],
    dislikedByUserIds: [],
  },
  {
    id: 'demo-2',
    userId: 'demo-system',
    authorName: 'Career Survivor',
    authorPhoto: 'https://api.dicebear.com/9.x/shapes/svg?seed=CareerSurvivor',
    content: 'Interview process 5 rounds ka tha, feedback zero mila. Isi liye transparency zaroori hai.',
    type: 'interview',
    likesCount: 0,
    dislikesCount: 0,
    createdAt: Date.now() - 1000 * 60 * 55,
    comments: [],
    likedByUserIds: [],
    dislikedByUserIds: [],
  },
];

const AuthContext = createContext<{
  user: AppUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}>({
  user: null,
  loading: true,
  signIn: async () => {},
  logout: async () => {},
});

const useAuth = () => useContext(AuthContext);

const postTypeMeta: Record<PostType, { label: string; accent: string; cardAccent: string; helper: string }> = {
  rant: {
    label: 'Burnout / Rant',
    accent: 'bg-red-200 text-red-950',
    cardAccent: 'from-red-200 via-white to-white',
    helper: 'Vent about pressure, chaos, or toxic culture.',
  },
  tip: {
    label: 'Career Tip',
    accent: 'bg-sky-200 text-sky-950',
    cardAccent: 'from-sky-200 via-white to-white',
    helper: 'Share a practical lesson people can use today.',
  },
  interview: {
    label: 'Interview Leak',
    accent: 'bg-emerald-200 text-emerald-950',
    cardAccent: 'from-emerald-200 via-white to-white',
    helper: 'Expose weird rounds, ghosting, or honest feedback.',
  },
  review: {
    label: 'Company Review',
    accent: 'bg-fuchsia-200 text-fuchsia-950',
    cardAccent: 'from-fuchsia-200 via-white to-white',
    helper: 'Review leadership, culture, growth, and reality.',
  },
  salary: {
    label: 'Salary Truth',
    accent: 'bg-yellow-200 text-yellow-950',
    cardAccent: 'from-yellow-200 via-white to-white',
    helper: 'Share compensation signals with real context.',
  },
};

const tabMeta: Record<string, { eyebrow: string; title: string; description: string }> = {
  feed: {
    eyebrow: 'Unfiltered Career Signal',
    title: 'The Authentic Feed',
    description: 'Raw stories, practical truths, and signals that cut through polished LinkedIn noise.',
  },
  interviews: {
    eyebrow: 'Hiring Reality',
    title: 'Interview Horror Stories',
    description: 'See how companies actually treat candidates, not how they say they do.',
  },
  salaries: {
    eyebrow: 'Money Talk',
    title: 'Salary Transparency',
    description: 'Use real compensation context to negotiate with more confidence.',
  },
  burnout: {
    eyebrow: 'Pressure Check',
    title: 'The Burnout Corner',
    description: 'A space for overwork, anxiety, and workplace red flags people usually hide.',
  },
  companies: {
    eyebrow: 'Inside Scoop',
    title: 'Company Truths',
    description: 'Culture, leadership, and promises reviewed by people living the experience.',
  },
};

const getFilteredPosts = (allPosts: HonestPost[], activeTab: string) => {
  if (activeTab === 'interviews') return allPosts.filter((post) => post.type === 'interview');
  if (activeTab === 'salaries') return allPosts.filter((post) => post.type === 'salary');
  if (activeTab === 'burnout') return allPosts.filter((post) => post.type === 'rant');
  if (activeTab === 'companies') return allPosts.filter((post) => post.type === 'review');
  return allPosts;
};

const loadDemoUser = (): AppUser | null => {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(DEMO_USER_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AppUser;
    if (!parsed || typeof parsed !== 'object') return null;

    // Migrate legacy shared demo identity so each browser/device gets its own user id.
    if (parsed.uid === 'demo-user') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const saveDemoUser = (user: AppUser | null) => {
  if (typeof window === 'undefined') return;

  if (!user) {
    window.localStorage.removeItem(DEMO_USER_KEY);
    return;
  }

  window.localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
};

const loadDemoPosts = (): HonestPost[] => {
  if (typeof window === 'undefined') return demoSeedPosts;

  const raw = window.localStorage.getItem(DEMO_POSTS_KEY);
  if (!raw) {
    window.localStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(demoSeedPosts));
    return demoSeedPosts;
  }

  try {
    const parsed = JSON.parse(raw) as HonestPost[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : demoSeedPosts;
  } catch {
    return demoSeedPosts;
  }
};

const saveDemoPosts = (posts: HonestPost[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(posts));
};

const resetDemoPosts = () => {
  saveDemoPosts(demoSeedPosts);
  return demoSeedPosts;
};

const loadLikedPosts = (): string[] => {
  if (typeof window === 'undefined') return [];

  const raw = window.localStorage.getItem(LIKED_POSTS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveLikedPosts = (postIds: string[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LIKED_POSTS_KEY, JSON.stringify(postIds));
};

const loadDislikedPosts = (): string[] => {
  if (typeof window === 'undefined') return [];

  const raw = window.localStorage.getItem(DISLIKED_POSTS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveDislikedPosts = (postIds: string[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DISLIKED_POSTS_KEY, JSON.stringify(postIds));
};

const loadLocalComments = (): Record<string, PostComment[]> => {
  if (typeof window === 'undefined') return {};

  const raw = window.localStorage.getItem(LOCAL_COMMENTS_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, PostComment[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const saveLocalComments = (commentsByPost: Record<string, PostComment[]>) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(commentsByPost));
};

const isDemoOptedIn = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(DEMO_OPT_IN_KEY) === 'true';
};

const setDemoOptIn = (enabled: boolean) => {
  if (typeof window === 'undefined') return;
  if (enabled) {
    window.localStorage.setItem(DEMO_OPT_IN_KEY, 'true');
  } else {
    window.localStorage.removeItem(DEMO_OPT_IN_KEY);
  }
};

const getDemoApiBase = () => {
  if (typeof window === 'undefined') return 'http://localhost:3101/api/demo';
  return `${window.location.protocol}//${window.location.hostname}:3101/api/demo`;
};

const createDemoUser = (): AppUser => {
  let randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  if (typeof window !== 'undefined') {
    const savedDeviceId = window.localStorage.getItem(DEMO_DEVICE_ID_KEY);
    if (savedDeviceId) {
      randomPart = savedDeviceId;
    } else {
      window.localStorage.setItem(DEMO_DEVICE_ID_KEY, randomPart);
    }
  }
  return {
    uid: `demo-${randomPart}`,
    displayName: 'Demo User',
    photoURL: DEMO_AVATAR,
    email: null,
    isDemo: true,
  };
};

const getAnonymousCommentName = (userId: string) => {
  const safeId = userId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'USER';
  return `Anonymous ${safeId}`;
};

const getPostTimeLabel = (createdAt: HonestPost['createdAt']) => {
  if (createdAt?.toDate) {
    return formatDistanceToNow(createdAt.toDate(), { addSuffix: true });
  }

  if (typeof createdAt === 'number') {
    return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  }

  return 'Just now';
};

const Navbar = ({ authMode }: { authMode: AuthMode }) => {
  const { user, logout } = useAuth();
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b-4 border-black bg-white">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="bg-black p-2 text-xl font-black italic tracking-tighter text-white">
            HL
          </div>
          <div className="min-w-0">
            <span className="block truncate font-black tracking-tighter text-lg sm:text-xl md:text-2xl">HONESTLINK</span>
            {authMode === 'demo' ? (
              <span className="inline-block border-2 border-black bg-yellow-200 px-2 py-0.5 text-[10px] font-black uppercase sm:hidden">
                Demo
              </span>
            ) : null}
          </div>
          {authMode === 'demo' ? (
            <span className="hidden border-2 border-black bg-yellow-200 px-2 py-1 text-xs font-black uppercase sm:inline-block">
              Demo Mode
            </span>
          ) : null}
        </div>

        <div className="hidden flex-1 px-4 sm:block sm:max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search for honest reviews, salaries..."
              className="w-full border-2 border-black py-2 pr-4 pl-10 focus:bg-yellow-50 focus:outline-none"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setShowMobileSearch((prev) => !prev)}
            className="border-2 border-black p-2 transition-colors hover:bg-yellow-100 sm:hidden"
            aria-label={showMobileSearch ? 'Close search' : 'Open search'}
            aria-expanded={showMobileSearch}
          >
            {showMobileSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden text-right md:block">
                <p className="text-sm leading-tight font-black uppercase">{user.displayName || 'User'}</p>
                <p className="text-[10px] font-bold uppercase text-gray-500">
                  {authMode === 'demo' ? `Demo ${user.uid.replace('demo-', '')}` : user.email || 'Signed in'}
                </p>
              </div>
              <img
                src={user.photoURL || DEMO_AVATAR}
                alt={user.displayName || 'User'}
                className="h-9 w-9 border-2 border-black sm:h-10 sm:w-10"
              />
              <button
                onClick={logout}
                className="border-2 border-black p-2 transition-colors hover:bg-red-500 hover:text-white"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {showMobileSearch ? (
        <div className="border-t-2 border-black px-4 pb-4 sm:hidden">
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search for honest reviews, salaries..."
              className="w-full border-2 border-black py-2 pr-4 pl-10 focus:bg-yellow-50 focus:outline-none"
            />
          </div>
        </div>
      ) : null}
    </nav>
  );
};

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (t: string) => void }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuItems = [
    { id: 'feed', icon: Briefcase, label: 'The Feed' },
    { id: 'interviews', icon: MessageCircle, label: 'Interview Leaks' },
    { id: 'salaries', icon: BarChart, label: 'Salary Truths' },
    { id: 'burnout', icon: Flame, label: 'Burnout Corner' },
    { id: 'companies', icon: TrendingUp, label: 'Company Reviews' },
  ];

  return (
    <aside className="w-full md:w-64 md:sticky md:top-[92px] md:h-fit">
      <button
        type="button"
        onClick={() => setIsMobileMenuOpen((prev) => !prev)}
        className="mb-4 flex w-full items-center justify-between border-4 border-black bg-white px-4 py-3 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:hidden"
        aria-expanded={isMobileMenuOpen}
      >
        <span>Browse Sections</span>
        {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <div className={cn('space-y-2', isMobileMenuOpen ? 'block' : 'hidden md:block')}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              setIsMobileMenuOpen(false);
            }}
            className={cn(
              'flex w-full items-center gap-3 border-2 border-black px-4 py-3 text-left font-bold transition-all',
              activeTab === item.id
                ? 'translate-x-1 translate-y-1 bg-black text-white shadow-none'
                : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-100 active:translate-x-1 active:translate-y-1 active:shadow-none'
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="min-w-0">{item.label}</span>
          </button>
        ))}

        <div className="mt-6 space-y-2 border-2 border-black bg-yellow-50 p-4 font-bold">
          <p className="text-sm uppercase tracking-wider text-gray-500 italic">Trending Honesties</p>
          <p className="cursor-pointer hover:underline">#TechLayoffs2026</p>
          <p className="cursor-pointer hover:underline">#UnpaidOvertime</p>
          <p className="cursor-pointer hover:underline">#SalaryTransparency</p>
        </div>
      </div>
    </aside>
  );
};

const PostForm = ({
  onSubmitPost,
}: {
  onSubmitPost: (content: string, type: PostType) => Promise<void>;
}) => {
  const [content, setContent] = useState('');
  const [type, setType] = useState<PostType>('rant');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const characterCount = content.trim().length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const trimmedContent = content.trim();
    setIsSubmitting(true);
    try {
      await onSubmitPost(trimmedContent, type);
      setContent('');
    } catch (err) {
      console.error('Post error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8 border-4 border-black bg-white p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:p-5">
      <div className="mb-4 flex flex-col gap-3 border-b-2 border-dashed border-black/20 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-gray-500">New Honest Post</p>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">Say What People Avoid Saying</h2>
          <p className="mt-1 max-w-2xl text-sm font-medium text-gray-600">
            Pick the lane, write the truth, and keep it useful for the next person.
          </p>
        </div>
        <div className={cn('w-fit border-2 border-black px-3 py-2 text-xs font-black uppercase', postTypeMeta[type].accent)}>
          {postTypeMeta[type].label}
        </div>
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {(['rant', 'tip', 'interview', 'review', 'salary'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              'px-3 py-1 border-2 border-black text-xs font-black uppercase whitespace-nowrap transition-transform hover:-translate-y-0.5',
              type === t ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="mb-3 text-sm font-bold text-gray-500">{postTypeMeta[type].helper}</p>
      <textarea
        placeholder="Share something brutally honest about your career today..."
        className="h-24 w-full resize-none border-2 border-black p-3 font-medium focus:bg-yellow-50 focus:outline-none sm:h-28"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase text-gray-500">
        <span>Keep it specific, useful, and real.</span>
        <span>{characterCount} chars</span>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <button type="button" className="border-2 border-black p-2 hover:bg-gray-100"><Share2 className="h-4 w-4" /></button>
          <button type="button" className="border-2 border-black p-2 hover:bg-gray-100"><AlertCircle className="h-4 w-4" /></button>
        </div>
        <button
          disabled={isSubmitting || !content.trim()}
          className="w-full border-2 border-black bg-black px-6 py-2 font-black text-white transition-colors hover:bg-white hover:text-black disabled:opacity-50 sm:w-auto"
        >
          {isSubmitting ? 'POSTING...' : 'SPILL THE BEANS'}
        </button>
      </div>
    </form>
  );
};

const PostCard = ({
  post,
  onLike,
  onDislike,
  onShare,
  onAddComment,
  isLiked,
  isDisliked,
  shareStatus,
}: {
  post: HonestPost;
  onLike: (postId: string) => Promise<void>;
  onDislike: (postId: string) => Promise<void>;
  onShare: (post: HonestPost) => Promise<void>;
  onAddComment: (postId: string, text: string, parentCommentId?: string) => Promise<void>;
  isLiked: boolean;
  isDisliked: boolean;
  shareStatus: string | null;
}) => {
  const typeColors = {
    rant: 'bg-red-200',
    tip: 'bg-blue-200',
    interview: 'bg-green-200',
    review: 'bg-purple-200',
    salary: 'bg-yellow-200',
  };
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyOpenFor, setReplyOpenFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    await onAddComment(post.id, commentText.trim());
    setCommentText('');
    setCommentOpen(false);
  };

  const handleReplySubmit = async (e: React.FormEvent, commentId: string) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    await onAddComment(post.id, replyText.trim(), commentId);
    setReplyText('');
    setReplyOpenFor(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      layout
      className="mb-6 overflow-hidden border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]"
    >
      <div className={cn('bg-gradient-to-r', postTypeMeta[post.type].cardAccent)}>
        <div className="flex flex-col gap-3 border-b-2 border-black p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img src={post.authorPhoto || DEMO_AVATAR} alt={post.authorName} className="h-10 w-10 shrink-0 border-2 border-black" />
            <div className="min-w-0">
              <h3 className="text-base leading-tight font-black uppercase sm:text-lg">{post.authorName}</h3>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase italic text-gray-500">
                <span>{getPostTimeLabel(post.createdAt)}</span>
                <span className="hidden sm:inline">•</span>
                <span>Anonymous Signal</span>
              </div>
            </div>
          </div>
          <div className={cn('w-fit border-2 border-black px-3 py-1 text-xs font-black uppercase italic tracking-widest', typeColors[post.type])}>
            {post.type}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <p className="whitespace-pre-wrap text-lg leading-relaxed font-medium sm:text-xl">{post.content}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="border-2 border-black bg-black px-2 py-1 text-[10px] font-black uppercase text-white">
            Honest Signal
          </span>
          <span className="border-2 border-black bg-white px-2 py-1 text-[10px] font-black uppercase text-gray-700">
            {post.comments?.length ?? 0} conversation
          </span>
          <span className="border-2 border-black bg-white px-2 py-1 text-[10px] font-black uppercase text-gray-700">
            {(post.likesCount ?? 0) + (post.dislikesCount ?? 0)} reactions
          </span>
        </div>
      </div>

      {commentOpen ? (
        <form onSubmit={handleCommentSubmit} className="px-4 pb-4 sm:px-6">
          <div className="border-2 border-black p-3 bg-blue-50">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="h-20 w-full resize-none border-2 border-black bg-white p-2 focus:outline-none"
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setCommentOpen(false)}
                className="border-2 border-black bg-white px-3 py-1 text-xs font-black uppercase hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="border-2 border-black bg-black px-3 py-1 text-xs font-black uppercase text-white disabled:opacity-50"
              >
                Add Comment
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {post.comments && post.comments.length > 0 ? (
        <div className="space-y-2 px-4 pb-4 sm:px-6">
          {post.comments.map((comment) => (
            <div key={comment.id} className="border-2 border-black bg-gray-50 p-3">
              <p className="text-xs font-black uppercase">{comment.userName}</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{comment.text}</p>
              <button
                onClick={() => setReplyOpenFor(replyOpenFor === comment.id ? null : comment.id)}
                className="mt-2 text-xs font-black uppercase underline"
              >
                Reply
              </button>
              {replyOpenFor === comment.id ? (
                <form onSubmit={(e) => handleReplySubmit(e, comment.id)} className="mt-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    className="h-16 w-full resize-none border-2 border-black bg-white p-2 focus:outline-none"
                  />
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setReplyOpenFor(null)}
                      className="border-2 border-black bg-white px-3 py-1 text-xs font-black uppercase hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!replyText.trim()}
                      className="border-2 border-black bg-black px-3 py-1 text-xs font-black uppercase text-white disabled:opacity-50"
                    >
                      Reply
                    </button>
                  </div>
                </form>
              ) : null}
              {comment.replies && comment.replies.length > 0 ? (
                <div className="mt-3 ml-2 space-y-2 sm:ml-4">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="border-2 border-black bg-white p-3">
                      <p className="text-[10px] font-black uppercase">{reply.userName}</p>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{reply.text}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t-2 border-black p-3 sm:gap-4">
        <button
          onClick={() => onLike(post.id)}
          className="flex items-center gap-2 border-2 border-transparent p-2 transition-all hover:border-black hover:bg-red-50"
        >
          <Heart className="h-5 w-5 text-red-500" fill={isLiked ? 'currentColor' : 'none'} />
          <span className="font-black">{post.likesCount}</span>
        </button>
        <button
          onClick={() => onDislike(post.id)}
          className="flex items-center gap-2 border-2 border-transparent p-2 transition-all hover:border-black hover:bg-gray-100"
        >
          <ThumbsDown className="h-5 w-5" fill={isDisliked ? 'currentColor' : 'none'} />
          <span className="font-black">{post.dislikesCount ?? 0}</span>
        </button>
        <button
          onClick={() => setCommentOpen((prev) => !prev)}
          className="flex items-center gap-2 border-2 border-transparent p-2 text-left transition-all hover:border-black hover:bg-blue-50"
        >
          <MessageCircle className="h-5 w-5 text-blue-500" />
          <span className="font-black">Comment {post.comments?.length ? `(${post.comments.length})` : ''}</span>
        </button>
        <button
          onClick={() => onShare(post)}
          className="ml-auto border-2 border-transparent p-2 transition-all hover:border-black"
          title={shareStatus ?? 'Share post'}
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>
      {shareStatus ? (
        <div className="px-3 pb-3 text-xs font-black uppercase text-gray-500">{shareStatus}</div>
      ) : null}
    </motion.div>
  );
};

const AuthScreen = ({
  onDemoLogin,
}: {
  onDemoLogin: () => void;
}) => {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fde68a,_#facc15_45%,_#f59e0b)] p-4 sm:p-6">
      <motion.div
        initial={{ rotate: -2, scale: 0.9, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        className="mx-auto mt-4 max-w-xl border-[6px] border-black bg-white p-6 text-center shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] sm:mt-8 sm:border-8 sm:p-12 sm:shadow-[20px_20px_0px_0px_rgba(0,0,0,1)]"
      >
        <div className="mb-6 inline-block bg-black px-4 py-2 text-2xl font-black italic tracking-tighter text-white sm:text-4xl">
          HONESTLINK
        </div>
        <h1 className="mb-6 text-3xl leading-none font-black tracking-tighter uppercase sm:text-5xl">
          BECAUSE YOUR CAREER ISN&apos;T A HIGHLIGHT REEL.
        </h1>
        <p className="mb-8 border-l-4 border-black pl-4 text-left text-base font-bold italic sm:mb-10 sm:text-xl">
          Sick of the corporate fluff? <br />
          Join the community sharing the actual truth about interviews, salaries, and burnout.
        </p>

        <div className="space-y-3">
          <button
            onClick={signIn}
            className="group flex w-full items-center justify-center gap-3 border-4 border-black bg-black px-5 py-4 text-lg font-black text-white transition-all hover:bg-white hover:text-black sm:gap-4 sm:px-8 sm:text-2xl"
          >
            <TrendingUp className="h-6 w-6 group-hover:animate-bounce sm:h-8 sm:w-8" />
            LOG IN HONESTLY
          </button>
          <button
            onClick={onDemoLogin}
            className="w-full border-4 border-black bg-white px-5 py-4 text-base font-black text-black transition-all hover:bg-yellow-100 sm:px-8 sm:text-xl"
          >
            CONTINUE IN DEMO MODE
          </button>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] font-black uppercase italic tracking-widest opacity-50 sm:text-xs">
          <span>Honest Voices</span>
          <span>Actual Salaries</span>
          <span>Burnout Support</span>
        </div>
      </motion.div>

      <div className="mx-auto mt-6 grid w-full max-w-4xl gap-4 md:mt-10 md:grid-cols-3">
        {[
          ['No fake flex', 'People come here for signal, not polished personal branding.'],
          ['Career intel', 'Interview loops, salary clues, and culture warnings in one place.'],
          ['Safe honesty', 'Anonymous posting makes hard truths easier to share.'],
        ].map(([title, desc]) => (
          <div key={title} className="border-4 border-black bg-white p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Why It Hits</p>
            <h3 className="mt-2 text-xl font-black uppercase">{title}</h3>
            <p className="mt-2 text-sm font-bold text-gray-600">{desc}</p>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-8 grid w-full max-w-2xl gap-4 text-black font-black md:mt-12 md:grid-cols-2">
        <div className="overflow-hidden border-2 border-black bg-white p-2">
          <div className="animate-marquee whitespace-nowrap">
            <span className="pr-8">NEW SALARY LEAKED: SENIOR DEV EARNING $250K WITH 2HRS OF ACTUAL WORK</span>
            <span>NEW SALARY LEAKED: SENIOR DEV EARNING $250K WITH 2HRS OF ACTUAL WORK</span>
          </div>
        </div>
        <div className="overflow-hidden border-2 border-black bg-white p-2">
          <div className="animate-marquee whitespace-nowrap [animation-direction:reverse]">
            <span className="pr-8">TIPS: HOW TO SURVIVE A PIP WITHOUT LOSING YOUR MIND</span>
            <span>TIPS: HOW TO SURVIVE A PIP WITHOUT LOSING YOUR MIND</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('feed');
  const [posts, setPosts] = useState<HonestPost[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [localhostUrl, setLocalhostUrl] = useState<string | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);
  const [dislikedPostIds, setDislikedPostIds] = useState<string[]>([]);
  const [shareFeedbackByPost, setShareFeedbackByPost] = useState<Record<string, string | null>>({});
  const [postsError, setPostsError] = useState<string | null>(null);
  const activeMeta = tabMeta[activeTab] ?? tabMeta.feed;
  const totalComments = posts.reduce((sum, post) => sum + (post.comments?.length ?? 0), 0);
  const totalReactions = posts.reduce((sum, post) => sum + (post.likesCount ?? 0) + (post.dislikesCount ?? 0), 0);

  const enterDemoMode = (reason?: string) => {
    const demoUser = loadDemoUser() ?? createDemoUser();

    saveDemoUser(demoUser);
    if (loadDemoPosts().length === 0) {
      saveDemoPosts(demoSeedPosts);
    }
    setDemoOptIn(true);
    setUser(demoUser);
    setAuthMode('demo');
    setLoading(false);
    setAuthError(reason ?? 'Firebase login unavailable. Demo mode enabled so you can use the app.');
    setPostsError(null);
  };

  useEffect(() => {
    setLikedPostIds(loadLikedPosts());
    setDislikedPostIds(loadDislikedPosts());

    const savedDemoUser = isDemoOptedIn() ? loadDemoUser() : null;
    if (savedDemoUser) {
      setUser(savedDemoUser);
      setAuthMode('demo');
      setLoading(false);
      return;
    }

    if (!isDemoOptedIn()) {
      saveDemoUser(null);
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Honest User',
          photoURL: firebaseUser.photoURL || DEMO_AVATAR,
          email: firebaseUser.email,
        });
        setAuthMode('firebase');
        setPostsError(null);
      } else {
        setUser(null);
        setAuthMode(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    getRedirectResult(auth).catch((error) => {
      console.error('Redirect auth error:', error);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const { protocol, hostname, port, pathname, search, hash } = window.location;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      const localhostHost = port ? `localhost:${port}` : 'localhost';
      setLocalhostUrl(`${protocol}//${localhostHost}${pathname}${search}${hash}`);
    } else {
      setLocalhostUrl(null);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    if (authMode === 'demo') {
      let isActive = true;
      setPostsError(null);

      const syncDemoPosts = async () => {
        try {
          const response = await fetch(`${getDemoApiBase()}/posts`);
          const data = await response.json();
          if (!isActive) return;
          setPosts(getFilteredPosts(data.posts ?? [], activeTab));
        } catch (error) {
          console.error('Shared demo sync error:', error);
          const demoPosts = loadDemoPosts().sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
          if (isActive) {
            setPosts(getFilteredPosts(demoPosts, activeTab));
          }
        }
      };

      syncDemoPosts();
      const intervalId = window.setInterval(syncDemoPosts, 2000);
      return () => {
        isActive = false;
        window.clearInterval(intervalId);
      };
    }

    let q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));

    if (activeTab === 'interviews') {
      q = query(collection(db, 'posts'), where('type', '==', 'interview'), orderBy('createdAt', 'desc'), limit(50));
    } else if (activeTab === 'salaries') {
      q = query(collection(db, 'posts'), where('type', '==', 'salary'), orderBy('createdAt', 'desc'), limit(50));
    } else if (activeTab === 'burnout') {
      q = query(collection(db, 'posts'), where('type', '==', 'rant'), orderBy('createdAt', 'desc'), limit(50));
    } else if (activeTab === 'companies') {
      q = query(collection(db, 'posts'), where('type', '==', 'review'), orderBy('createdAt', 'desc'), limit(50));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const localComments = loadLocalComments();
        const nextPosts = snapshot.docs.map((snapshotDoc) => ({
          id: snapshotDoc.id,
          ...snapshotDoc.data(),
          comments: localComments[snapshotDoc.id] ?? [],
        } as HonestPost));
        setPosts(nextPosts);
        setPostsError(null);
      },
      (error) => {
        console.error('Firestore error:', error);
        setPosts([]);
        setPostsError('Realtime posts load nahi ho pa rahe. Firestore rules ya project access check karo.');
      }
    );

    return unsubscribe;
  }, [user, activeTab, authMode]);

  const signIn = async () => {
    try {
      setAuthError(null);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
      });
      let result;
      try {
        result = await signInWithPopup(auth, provider);
      } catch (popupError) {
        const popupCode = typeof popupError === 'object' && popupError && 'code' in popupError ? String(popupError.code) : '';
        if (popupCode.includes('auth/popup-blocked') || popupCode.includes('auth/cancelled-popup-request')) {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupError;
      }
      const signedInUser = result.user;
      const nextUser: AppUser = {
        uid: signedInUser.uid,
        displayName: signedInUser.displayName || 'Honest User',
        photoURL: signedInUser.photoURL || DEMO_AVATAR,
        email: signedInUser.email,
      };

      setUser(nextUser);
      setAuthMode('firebase');
      saveDemoUser(null);

      const userRef = doc(db, 'users', signedInUser.uid);
      await updateDoc(userRef, {
        displayName: signedInUser.displayName,
        photoURL: signedInUser.photoURL,
        email: signedInUser.email,
        lastLogin: serverTimestamp(),
      }).catch(async (err) => {
        if (err.code === 'not-found' || err.message?.includes('NOT_FOUND')) {
          await setDoc(userRef, {
            displayName: signedInUser.displayName,
            photoURL: signedInUser.photoURL,
            email: signedInUser.email,
            honestTitle: 'New Honest Member',
            bio: 'Just another career traveler being honest.',
            joinedAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
          });
        }
      });
    } catch (err) {
      console.error('Auth error:', err);
      const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
      const message = typeof err === 'object' && err && 'message' in err ? String(err.message) : 'Unknown sign-in error';

      if (code.includes('auth/unauthorized-domain')) {
        setAuthError('Firebase Authorized Domains issue aaya. Firebase console me localhost ya current host add karo.');
        return;
      }

      if (code.includes('auth/operation-not-allowed')) {
        setAuthError('Firebase me Google sign-in enabled nahi hai. Authentication > Sign-in method me Google enable karo.');
        return;
      }

      if (message.toLowerCase().includes('requested action is invalid')) {
        setAuthError('Firebase auth handler invalid action de raha hai. Auth configuration dubara check karo.');
        return;
      }

      setAuthError(`Login failed: ${message}`);
    }
  };

  const logout = async () => {
    if (authMode === 'demo') {
      setUser(null);
      setAuthMode(null);
      setAuthError(null);
      setPostsError(null);
      setDemoOptIn(false);
      saveDemoUser(null);
      return;
    }

    await signOut(auth);
    setDemoOptIn(false);
    saveDemoUser(null);
  };

  const handleCreatePost = async (content: string, type: PostType) => {
    if (!user) return;

    if (authMode === 'demo') {
      const response = await fetch(`${getDemoApiBase()}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          authorName: user.displayName,
          authorPhoto: user.photoURL,
          content,
          type,
        }),
      });
      const data = await response.json();
      setPosts(getFilteredPosts(data.posts ?? [], activeTab));
      return;
    }

    await addDoc(collection(db, 'posts'), {
      userId: user.uid,
      authorName: user.displayName,
      authorPhoto: user.photoURL,
      content,
      type,
      likesCount: 0,
      createdAt: serverTimestamp(),
    });
  };

  const handleLikePost = async (postId: string) => {
    const currentPost = posts.find((post) => post.id === postId);
    const alreadyLikedInDemo = authMode === 'demo' && !!currentPost?.likedByUserIds?.includes(user?.uid ?? '');

    if (authMode === 'demo') {
      const response = await fetch(`${getDemoApiBase()}/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.uid,
        }),
      });
      const data = await response.json();
      setPosts(getFilteredPosts(data.posts ?? [], activeTab));
      if (alreadyLikedInDemo) {
        const nextLikedPostIds = likedPostIds.filter((id) => id !== postId);
        setLikedPostIds(nextLikedPostIds);
        saveLikedPosts(nextLikedPostIds);
      } else {
        const nextLikedPostIds = [...new Set([...likedPostIds, postId])];
        setLikedPostIds(nextLikedPostIds);
        saveLikedPosts(nextLikedPostIds);
        const nextDislikedPostIds = dislikedPostIds.filter((id) => id !== postId);
        setDislikedPostIds(nextDislikedPostIds);
        saveDislikedPosts(nextDislikedPostIds);
      }
      return;
    }

    if (likedPostIds.includes(postId)) {
      await updateDoc(doc(db, 'posts', postId), {
        likesCount: increment(-1),
      });
      const nextLikedPostIds = likedPostIds.filter((id) => id !== postId);
      setLikedPostIds(nextLikedPostIds);
      saveLikedPosts(nextLikedPostIds);
      return;
    }

    if (dislikedPostIds.includes(postId)) {
      const nextDislikedPostIds = dislikedPostIds.filter((id) => id !== postId);
      setDislikedPostIds(nextDislikedPostIds);
      saveDislikedPosts(nextDislikedPostIds);
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId
            ? { ...post, dislikesCount: Math.max((post.dislikesCount ?? 0) - 1, 0) }
            : post
        )
      );
    }

    await updateDoc(doc(db, 'posts', postId), {
      likesCount: increment(1),
    });
    const nextLikedPostIds = [...likedPostIds, postId];
    setLikedPostIds(nextLikedPostIds);
    saveLikedPosts(nextLikedPostIds);
  };

  const handleDislikePost = async (postId: string) => {
    const currentPost = posts.find((post) => post.id === postId);
    const alreadyDislikedInDemo = authMode === 'demo' && !!currentPost?.dislikedByUserIds?.includes(user?.uid ?? '');

    if (authMode === 'demo') {
      const response = await fetch(`${getDemoApiBase()}/posts/${postId}/dislike`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.uid,
        }),
      });
      const data = await response.json();
      setPosts(getFilteredPosts(data.posts ?? [], activeTab));
      if (alreadyDislikedInDemo) {
        const nextDislikedPostIds = dislikedPostIds.filter((id) => id !== postId);
        setDislikedPostIds(nextDislikedPostIds);
        saveDislikedPosts(nextDislikedPostIds);
      } else {
        const nextDislikedPostIds = [...new Set([...dislikedPostIds, postId])];
        setDislikedPostIds(nextDislikedPostIds);
        saveDislikedPosts(nextDislikedPostIds);
        const nextLikedPostIds = likedPostIds.filter((id) => id !== postId);
        setLikedPostIds(nextLikedPostIds);
        saveLikedPosts(nextLikedPostIds);
      }
      return;
    }

    if (dislikedPostIds.includes(postId)) {
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId
            ? { ...post, dislikesCount: Math.max((post.dislikesCount ?? 0) - 1, 0) }
            : post
        )
      );
      const nextDislikedPostIds = dislikedPostIds.filter((id) => id !== postId);
      setDislikedPostIds(nextDislikedPostIds);
      saveDislikedPosts(nextDislikedPostIds);
      return;
    }

    const nextLikedPostIds = likedPostIds.filter((id) => id !== postId);
    if (nextLikedPostIds.length !== likedPostIds.length) {
      saveLikedPosts(nextLikedPostIds);
      setLikedPostIds(nextLikedPostIds);
      await updateDoc(doc(db, 'posts', postId), {
        likesCount: increment(-1),
      });
    }
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId
          ? { ...post, dislikesCount: (post.dislikesCount ?? 0) + 1 }
          : post
      )
    );
    const nextDislikedPostIds = [...dislikedPostIds, postId];
    setDislikedPostIds(nextDislikedPostIds);
    saveDislikedPosts(nextDislikedPostIds);
  };

  const handleAddComment = async (postId: string, text: string, parentCommentId?: string) => {
    if (!user) return;

    const nextCommentBase = {
      userName: getAnonymousCommentName(user.uid),
      text,
      createdAt: Date.now(),
    };

    if (authMode === 'demo') {
      const response = await fetch(`${getDemoApiBase()}/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName: nextCommentBase.userName,
          text,
          parentCommentId,
        }),
      });
      const data = await response.json();
      setPosts(getFilteredPosts(data.posts ?? [], activeTab));
      return;
    }

    const commentsByPost = loadLocalComments();
    const nextReply: PostReply = {
      id: `reply-${Date.now()}`,
      ...nextCommentBase,
    };
    const nextComment: PostComment = {
      id: `comment-${Date.now()}`,
      ...nextCommentBase,
      replies: [],
    };
    const existingComments = commentsByPost[postId] ?? [];
    const updatedComments = parentCommentId
      ? existingComments.map((comment) =>
          comment.id === parentCommentId
            ? { ...comment, replies: [...(comment.replies ?? []), nextReply] }
            : comment
        )
      : [...existingComments, nextComment];
    const nextCommentsByPost = {
      ...commentsByPost,
      [postId]: updatedComments,
    };
    saveLocalComments(nextCommentsByPost);
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId
          ? { ...post, comments: updatedComments }
          : post
      )
    );
  };

  const handleSharePost = async (post: HonestPost) => {
    const shareText = `${post.authorName}: ${post.content}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'HonestLink Post',
          text: shareText,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
      } else {
        throw new Error('Sharing unavailable');
      }

      setShareFeedbackByPost((current) => ({ ...current, [post.id]: 'Shared' }));
      window.setTimeout(() => {
        setShareFeedbackByPost((current) => ({ ...current, [post.id]: null }));
      }, 2000);
    } catch (error) {
      console.error('Share error:', error);
      setShareFeedbackByPost((current) => ({ ...current, [post.id]: 'Share failed' }));
    }
  };

  const handleClearDemoPosts = () => {
    if (authMode === 'demo') {
      fetch(`${getDemoApiBase()}/reset`, {
        method: 'POST',
      })
        .then((response) => response.json())
        .then((data) => {
          setPosts(getFilteredPosts(data.posts ?? [], activeTab));
          setLikedPostIds([]);
          saveLikedPosts([]);
          setDislikedPostIds([]);
          saveDislikedPosts([]);
        })
        .catch((error) => {
          console.error('Demo reset error:', error);
          const resetPosts = resetDemoPosts().sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
          setPosts(getFilteredPosts(resetPosts, activeTab));
        });
      return;
    }

    const resetPosts = resetDemoPosts().sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    setPosts(getFilteredPosts(resetPosts, activeTab));
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-8 border-black border-t-yellow-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthContext.Provider value={{ user, loading, signIn, logout }}>
        <AuthScreen onDemoLogin={() => enterDemoMode()} />
        {authError ? (
          <div className="fixed bottom-4 left-4 right-4 md:left-auto md:max-w-xl border-4 border-black bg-red-100 p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <p className="font-black uppercase mb-2">Login Error</p>
            <p className="font-bold text-sm">{authError}</p>
            <p className="mt-2 text-sm">
              Firebase Console me Authentication se Google sign-in enable karo aur Authorized domains list me apna host add karo, jaise localhost.
            </p>
            {localhostUrl ? (
              <p className="mt-2 text-sm font-bold">
                Quick fix link:{' '}
                <a href={localhostUrl} className="underline break-all">
                  {localhostUrl}
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logout }}>
      <div className="min-h-screen bg-[linear-gradient(180deg,_#f7f5ef_0%,_#efe8da_100%)] text-black font-sans selection:bg-yellow-300">
        <Navbar authMode={authMode} />

        {authMode === 'demo' ? (
          <div className="mx-auto max-w-6xl px-4 pt-4 sm:pt-6">
            <div className="flex flex-col gap-3 border-4 border-black bg-yellow-200 p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black uppercase">Demo Mode</p>
                <p className="mt-1 text-sm font-bold text-black/70">Try the full experience, test flows, and reset posts whenever you want.</p>
              </div>
              <button
                onClick={handleClearDemoPosts}
                className="border-2 border-black bg-white px-4 py-2 text-xs font-black uppercase hover:bg-black hover:text-white transition-colors"
              >
                Clear Demo Posts
              </button>
            </div>
          </div>
        ) : null}

        <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:gap-8 md:py-8">
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

          <div className="min-w-0 flex-1">
            <header className="mb-8">
              <div className="border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:p-6">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-gray-500">{activeMeta.eyebrow}</p>
                <h1 className="mt-2 text-3xl font-black tracking-tighter uppercase italic underline decoration-yellow-400 decoration-6 underline-offset-4 sm:text-4xl sm:decoration-8">
                  {activeMeta.title}
                </h1>
                <p className="mt-3 max-w-2xl text-base font-bold italic text-gray-600 sm:mt-4">
                  {activeMeta.description}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="border-2 border-black bg-[#f8f2e1] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Posts</p>
                    <p className="mt-1 text-2xl font-black">{posts.length}</p>
                  </div>
                  <div className="border-2 border-black bg-[#e4f4ec] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Reactions</p>
                    <p className="mt-1 text-2xl font-black">{totalReactions}</p>
                  </div>
                  <div className="border-2 border-black bg-[#e6eefb] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Conversations</p>
                    <p className="mt-1 text-2xl font-black">{totalComments}</p>
                  </div>
                </div>
              </div>
            </header>

            {postsError ? (
              <div className="mb-6 border-4 border-black bg-red-100 p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <p className="font-black uppercase">Live Data Error</p>
                <p className="mt-2 text-sm font-bold">{postsError}</p>
                <p className="mt-2 text-sm">
                  Demo data ab auto-load nahi hoga. Real Firebase access theek hote hi yahan actual posts dikhne lagenge.
                </p>
              </div>
            ) : null}

            <PostForm onSubmitPost={handleCreatePost} />

            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onLike={handleLikePost}
                    onDislike={handleDislikePost}
                    onShare={handleSharePost}
                    onAddComment={handleAddComment}
                    isLiked={
                      authMode === 'demo'
                        ? !!post.likedByUserIds?.includes(user?.uid ?? '')
                        : likedPostIds.includes(post.id)
                    }
                    isDisliked={
                      authMode === 'demo'
                        ? !!post.dislikedByUserIds?.includes(user?.uid ?? '')
                        : dislikedPostIds.includes(post.id)
                    }
                    shareStatus={shareFeedbackByPost[post.id] ?? null}
                  />
                ))}
              </AnimatePresence>

              {posts.length === 0 && (
                <div className="border-4 border-dashed border-black bg-gray-50 p-8 text-center sm:p-12">
                  <Flame className="mx-auto mb-4 h-12 w-12 opacity-20" />
                  <p className="font-black text-xl text-gray-400">NOTHING HONEST TO SHOW YET...</p>
                  <button onClick={() => setActiveTab('feed')} className="mt-4 font-bold underline">BACK TO FEED</button>
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:block w-72 space-y-6">
            <div className="border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Opportunity Radar</p>
              <h3 className="mb-4 mt-2 font-black uppercase italic">Job Board</h3>
              <div className="space-y-4">
                {[
                  { title: 'Junior Dev', comp: 'Stark Ind.', desc: 'Great coffee, terrible tech debt.' },
                  { title: 'Product Mgr', comp: 'Wayne Corp', desc: 'No meetings on Friday (lie).' },
                ].map((job, i) => (
                  <div key={i} className="cursor-pointer border-b-2 border-black pb-2 last:border-0 hover:bg-yellow-50">
                    <p className="font-black text-sm">{job.title}</p>
                    <p className="italic text-xs font-bold text-gray-500">{job.comp}</p>
                    <p className="text-xs mt-1">{job.desc}</p>
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 bg-black text-white py-2 font-black text-xs uppercase italic hover:bg-yellow-400 hover:text-black">View All Jobs</button>
            </div>

            <div className="border-4 border-black bg-black p-4 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <h3 className="font-black uppercase italic">Featured Post</h3>
              </div>
              <p className="text-sm italic">&quot;I spent 4 hours fixing a typo that was introduced by a senior dev who then blamed me in the standup.&quot;</p>
              <div className="mt-4 flex justify-between text-[10px] font-black uppercase">
                <span>1.2k AGREES</span>
                <span className="text-yellow-400 underline cursor-pointer">JOIN THE RAGE</span>
              </div>
            </div>

            <div className="border-4 border-black bg-[#dff3e7] p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-600">What Makes This Better</p>
              <h3 className="mt-2 text-xl font-black uppercase">Sharper UX</h3>
              <p className="mt-2 text-sm font-bold text-gray-700">
                Stronger hierarchy, quicker scanning, better mobile behavior, and clearer content context.
              </p>
            </div>
          </div>
        </main>

        <footer className="mt-16 border-t-8 border-black bg-white px-4 py-10 text-center sm:mt-20 sm:py-12">
          <div className="bg-black text-white inline-block px-2 py-1 font-black text-lg italic mb-4">HL</div>
          <p className="mb-2 text-2xl font-black uppercase tracking-tighter sm:text-3xl">HONESTLINK</p>
          <p className="mb-8 text-xs font-bold uppercase italic text-gray-500">Stop lying to yourself. Start living honestly.</p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-black uppercase underline decoration-2 underline-offset-4">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Support</a>
          </div>
        </footer>
      </div>
    </AuthContext.Provider>
  );
}
