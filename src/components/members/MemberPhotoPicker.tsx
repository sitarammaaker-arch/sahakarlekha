/**
 * MemberPhotoPicker (2026-10-17) — the photograph field of the admission forms (new application, record an admitted
 * member, edit). Haryana Act s.40 proviso: a primary society member furnishes a photograph. The file is held by the
 * form and uploaded (downscaled, private bucket) only once the member row is saved — see uploadMemberPhoto.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { photoFileError } from '@/lib/members/photo';

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
  /** The member's current photo (signed URL), shown until a new one is chosen. */
  existingUrl?: string | null;
  hi: boolean;
  onError?: (message: string) => void;
}

export const MemberPhotoPicker: React.FC<Props> = ({ file, onChange, existingUrl, hi, onError }) => {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    // A data URL (not an object URL): nothing to revoke, and no blob link that could pass for a download.
    let live = true;
    const r = new FileReader();
    r.onload = () => { if (live) setPreview(String(r.result)); };
    r.readAsDataURL(file);
    return () => { live = false; if (r.readyState === FileReader.LOADING) r.abort(); };
  }, [file]);
  const shown = preview || existingUrl || null;
  const pick = (f: File | undefined) => {
    if (!f) return;
    const bad = photoFileError(f);
    if (bad) { onError?.(bad); return; }
    onChange(f);
    if (input.current) input.current.value = '';
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs">{hi ? 'सदस्य की फ़ोटो' : 'Member photograph'}</Label>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground">
          {shown ? <img src={shown} alt="" className="h-full w-full object-cover" /> : <Camera className="h-6 w-6" />}
        </div>
        <div className="flex flex-col gap-1.5">
          <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => pick(e.target.files?.[0])} aria-label={hi ? 'फ़ोटो चुनें' : 'Choose photo'} />
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => input.current?.click()}>
            <Camera className="h-4 w-4" />{shown ? (hi ? 'फ़ोटो बदलें' : 'Change photo') : (hi ? 'फ़ोटो जोड़ें' : 'Add photo')}
          </Button>
          {file && (
            <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={() => onChange(null)}>
              <X className="h-4 w-4" />{hi ? 'हटाएँ' : 'Remove'}
            </Button>
          )}
          <p className="text-[11px] text-muted-foreground">{hi ? 'मोबाइल से सीधे फ़ोटो खींच सकते हैं। सदस्य सेव होने पर अपने-आप छोटी होकर सेव होगी।' : 'You can take it with the phone camera. Saved (downscaled) once the member is saved.'}</p>
        </div>
      </div>
    </div>
  );
};
