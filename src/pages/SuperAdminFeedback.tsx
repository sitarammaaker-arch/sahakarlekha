/**
 * SuperAdminFeedback — platform-owner inbox for everything submitted via the
 * public Contact form, ratings/reviews and in-app bug/suggestion reports
 * (all rows in the `feedback` table). Read/update is RLS-restricted to active
 * platform admins (see supabase/migrations/002_feedback.sql).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Inbox, RefreshCw, ArrowLeft, Mail, Building2, Clock, Star,
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
  const { toast } = useToast();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('new');

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      setRows((data as FeedbackRow[]) || []);
    } catch (e) {
      setErr('संदेश लोड नहीं हो सके। पक्का करें कि आप platform-admin के रूप में लॉग-इन हैं और माइग्रेशन 002_feedback.sql चल चुका है।');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: string) => {
    const prev = rows;
    setRows(rs => rs.map(r => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase.from('feedback').update({ status }).eq('id', id);
    if (error) {
      setRows(prev); // rollback — never leave UI out of sync with the DB
      toast({ title: 'अपडेट नहीं हुआ', description: 'स्थिति बदली नहीं जा सकी, फिर कोशिश करें।', variant: 'destructive' });
    }
  };

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
          <Button variant="outline" size="sm" className="gap-1" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> रिफ्रेश
          </Button>
        </div>
      </div>

      {/* Status filter */}
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

      {err && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20 mb-4">
          <CardContent className="p-4 flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {err}
          </CardContent>
        </Card>
      )}

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
