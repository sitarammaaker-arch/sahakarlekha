/**
 * SuperAdminFeedback — platform-owner inbox for everything submitted via the
 * public Contact form, ratings/reviews and in-app bug/suggestion reports
 * (all rows in the `feedback` table).
 *
 * Platform-admin sessions here are often JWT-less, so we read/update through
 * SECURITY DEFINER RPCs (admin_feedback_list / admin_feedback_set_status) that
 * re-verify the admin via email+password — see migration 003_feedback_admin_rpc.sql.
 * The password is held in memory only (module var) for the session; never persisted.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Inbox, RefreshCw, ArrowLeft, Mail, Building2, Clock, Star, Lock,
  CheckCircle2, Eye, AlertTriangle, MessageSquare, Bug, Lightbulb,
} from 'lucide-react';

interface FeedbackRow {
  id: string;
  created_at: string;
  type: string;
  name: string | null;
  email: string | null;
  society_name: string | null;
  message: string | null;
  rating: number | null;
  page_url: string | null;
  user_email: string | null;
  status: string;
}

// In-memory only (cleared on full reload / tab close). Never written to disk.
let sessionPw: string | null = null;

const TYPE_META: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  message:    { label: 'संदेश',  icon: MessageSquare, cls: 'bg-blue-100 text-blue-800' },
  bug:        { label: 'समस्या', icon: Bug,           cls: 'bg-red-100 text-red-800' },
  suggestion: { label: 'सुझाव',  icon: Lightbulb,     cls: 'bg-amber-100 text-amber-800' },
  review:     { label: 'रिव्यू', icon: Star,          cls: 'bg-violet-100 text-violet-800' },
  helpful:    { label: 'फ़ीडबैक', icon: CheckCircle2,  cls: 'bg-green-100 text-green-800' },
};

const STATUS_FILTERS = [
  { value: 'new', label: 'नए' },
  { value: 'seen', label: 'देखे गए' },
  { value: 'resolved', label: 'हल' },
  { value: 'all', label: 'सभी' },
];

function fmt(d: string) {
  try {
    return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return d;
  }
}

const SuperAdminFeedback: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const email = user?.email || '';

  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pw, setPw] = useState('');
  const [gateErr, setGateErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('new');

  const load = useCallback(async (password: string) => {
    setLoading(true);
    setGateErr(null);
    try {
      const { data, error } = await supabase.rpc('admin_feedback_list', {
        p_email: email,
        p_password: password,
      });
      if (error) throw error;
      sessionPw = password;
      setAuthed(true);
      setRows((data as FeedbackRow[]) || []);
    } catch (e) {
      sessionPw = null;
      setAuthed(false);
      setGateErr('लॉग-इन सत्यापित नहीं हुआ — पक्का करें कि यह आपके platform-admin का सही पासवर्ड है, और माइग्रेशन 003 चल चुका है।');
    } finally {
      setLoading(false);
    }
  }, [email]);

  // Auto-load if we already verified earlier this session.
  useEffect(() => {
    if (sessionPw) load(sessionPw);
  }, [load]);

  const setStatus = async (id: string, status: string) => {
    if (!sessionPw) return;
    const prev = rows;
    setRows(rs => rs.map(r => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase.rpc('admin_feedback_set_status', {
      p_email: email, p_password: sessionPw, p_id: id, p_status: status,
    });
    if (error) {
      setRows(prev); // rollback — never leave the UI out of sync with the DB
      toast({ title: 'अपडेट नहीं हुआ', description: 'स्थिति बदली नहीं जा सकी, फिर कोशिश करें।', variant: 'destructive' });
    }
  };

  // ── Password gate ───────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="max-w-md mx-auto px-4 py-10">
        <Link to="/super-admin" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-4 hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> डैशबोर्ड
        </Link>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Feedback Inbox</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              सुरक्षा के लिए अपना platform-admin पासवर्ड डालें। (यह सिर्फ़ इसी सत्र के लिए, मेमोरी में रहेगा।)
            </p>
            <form onSubmit={(e) => { e.preventDefault(); if (pw) load(pw); }} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="adminpw">पासवर्ड ({email || 'admin'})</Label>
                <Input id="adminpw" type="password" value={pw} autoFocus
                  onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
              </div>
              {gateErr && (
                <p className="text-sm text-red-600 flex items-start gap-1.5"><AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {gateErr}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading || !pw}>
                {loading ? 'जाँच रहे हैं…' : 'खोलें'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Inbox ───────────────────────────────────────────────────────
  const visible = rows.filter(r => statusFilter === 'all' || r.status === statusFilter);
  const newCount = rows.filter(r => r.status === 'new').length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" /> Feedback Inbox
            {newCount > 0 && <Badge className="bg-primary text-primary-foreground">{newCount} नए</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">संपर्क संदेश, सुझाव, समस्याएँ व रिव्यू — सब यहाँ।</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/super-admin"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> डैशबोर्ड</Button></Link>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => sessionPw && load(sessionPw)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> रिफ्रेश
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              statusFilter === f.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-10 text-center">लोड हो रहा है…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">इस फ़िल्टर में कोई संदेश नहीं।</p>
      ) : (
        <div className="space-y-3">
          {visible.map(r => {
            const tm = TYPE_META[r.type] || TYPE_META.message;
            const Icon = tm.icon;
            return (
              <Card key={r.id} className={r.status === 'new' ? 'border-primary/40' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${tm.cls}`}>
                        <Icon className="h-3.5 w-3.5" /> {tm.label}
                      </span>
                      <span className="font-semibold text-foreground">{r.name || 'अनाम'}</span>
                      {typeof r.rating === 'number' && (
                        <span className="inline-flex items-center gap-0.5 text-amber-600 text-sm">
                          {r.rating} <Star className="h-3.5 w-3.5 fill-current" />
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {fmt(r.created_at)}
                    </span>
                  </div>

                  {r.message && <p className="text-sm text-foreground/90 mt-2 whitespace-pre-wrap">{r.message}</p>}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-3">
                    {r.email && <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 hover:text-primary"><Mail className="h-3.5 w-3.5" /> {r.email}</a>}
                    {r.society_name && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {r.society_name}</span>}
                    {r.page_url && <span className="truncate max-w-[220px]">{r.page_url.replace('https://sahakarlekha.com', '')}</span>}
                  </div>

                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    {r.status !== 'seen' && (
                      <Button variant="outline" size="sm" className="gap-1 h-8" onClick={() => setStatus(r.id, 'seen')}>
                        <Eye className="h-3.5 w-3.5" /> देखा
                      </Button>
                    )}
                    {r.status !== 'resolved' && (
                      <Button variant="outline" size="sm" className="gap-1 h-8" onClick={() => setStatus(r.id, 'resolved')}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> हल किया
                      </Button>
                    )}
                    {r.status !== 'new' && (
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => setStatus(r.id, 'new')}>नया रखें</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SuperAdminFeedback;
