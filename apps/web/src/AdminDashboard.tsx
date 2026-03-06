import { useCallback, useEffect, useState, FormEvent } from 'react';
import MDEditor from '@uiw/react-md-editor';

type Role = 'tenant_admin' | 'workspace_admin' | 'product_manager' | 'engineering_manager' | 'contributor' | 'viewer';

type Session = {
    workspaceId: string;
    userId: string;
    userEmail: string;
    role: Role;
    accessToken: string;
};

type IdeaStatus = 'new' | 'under_review' | 'accepted' | 'planned' | 'in_progress' | 'completed' | 'declined';

type Idea = {
    id: string;
    title: string;
    status: IdeaStatus;
    voteCount: number;
    createdAt: string;
};

type BoardSettings = {
    boardId: string;
    portalTitle: string | null;
    customAccentColor: string | null;
    customLogoUrl: string | null;
    headerBgColor: string | null;
    customCss: string | null;
    fontFamily: string | null;
    hidePoweredBy: boolean;
};

const defaultWorkspaceId = '22222222-2222-2222-2222-222222222222';
const defaultUserId = '33333333-3333-3333-3333-333333333333';
const defaultUserEmail = 'admin@customervoice.local';

function requestHeaders(params: Session): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-workspace-id': params.workspaceId,
        'x-user-id': params.userId,
        'x-role': params.role,
        'x-user-email': params.userEmail,
    };
    if (params.accessToken.trim().length > 0) {
        headers.authorization = `Bearer ${params.accessToken.trim()}`;
    }
    return headers;
}

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export function AdminDashboard({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
    const parts = path.split('/');
    const boardsIdx = parts.indexOf('boards');
    const boardSlug = boardsIdx >= 0 && parts.length > boardsIdx + 1 ? parts[boardsIdx + 1] : null;

    const [session, setSession] = useState<Session | null>(null);
    const [authNotice, setAuthNotice] = useState<string | null>(null);
    const [currentTab, setCurrentTab] = useState<'settings' | 'ideas' | 'changelog'>('settings');

    const [workspaceIdFn, setWorkspaceIdFn] = useState(defaultWorkspaceId);
    const [userIdFn, setUserIdFn] = useState(defaultUserId);
    const [userEmailFn, setUserEmailFn] = useState(defaultUserEmail);
    const [accessTokenFn, setAccessTokenFn] = useState('');

    const [boardId, setBoardId] = useState<string | null>(null);
    const [settings, setSettings] = useState<BoardSettings | null>(null);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [bgColor, setBgColor] = useState('#ffffff');
    const [accentColor, setAccentColor] = useState('#000000');
    const [logoUrl, setLogoUrl] = useState('');
    const [hidePoweredBy, setHidePoweredBy] = useState(false);
    const [saveBusy, setSaveBusy] = useState(false);

    const [changelogTitle, setChangelogTitle] = useState('');
    const [changelogBody, setChangelogBody] = useState('');
    const [changelogType, setChangelogType] = useState<'feature' | 'improvement' | 'bugfix'>('feature');
    const [changelogBusy, setChangelogBusy] = useState(false);

    useEffect(() => {
        if (!boardSlug) return;
        const fetchBoardInfo = async () => {
            try {
                const res = await fetch(`${apiBase}/public/boards/${boardSlug}/settings`);
                if (res.ok) {
                    const data = await res.json();
                    setBoardId(data.boardId);
                    setSettings(data);
                    setBgColor(data.headerBgColor || '#ffffff');
                    setAccentColor(data.customAccentColor || '#000000');
                    setLogoUrl(data.customLogoUrl || '');
                    setHidePoweredBy(data.hidePoweredBy || false);
                }
            } catch (err) {
                console.error(err);
            }
        };
        void fetchBoardInfo();
    }, [boardSlug]);

    const loadIdeas = useCallback(async () => {
        if (!session || !boardId) return;
        try {
            const h = requestHeaders(session);
            const res = await fetch(`${apiBase}/workspaces/${session.workspaceId}/boards/${boardId}/ideas?status=all&sort=newest`, { headers: h });
            if (res.ok) {
                const data = await res.json();
                setIdeas(data.items);
            }
        } catch (err) {
            console.error(err);
        }
    }, [session, boardId]);

    useEffect(() => {
        if (session && currentTab === 'ideas') {
            void loadIdeas();
        }
    }, [session, currentTab, loadIdeas]);

    const handleLogin = (e: FormEvent) => {
        e.preventDefault();
        setSession({
            workspaceId: workspaceIdFn,
            userId: userIdFn,
            userEmail: userEmailFn,
            role: 'workspace_admin',
            accessToken: accessTokenFn
        });
        setAuthNotice(null);
    };

    const handleSaveSettings = async (e: FormEvent) => {
        e.preventDefault();
        if (!session || !boardId) return;
        setSaveBusy(true);
        try {
            const h = requestHeaders(session);
            const res = await fetch(`${apiBase}/workspaces/${session.workspaceId}/boards/${boardId}/settings`, {
                method: 'PATCH',
                headers: h,
                body: JSON.stringify({
                    headerBgColor: bgColor,
                    customAccentColor: accentColor,
                    customLogoUrl: logoUrl,
                    hidePoweredBy
                })
            });
            if (res.ok) {
                alert('Settings saved!');
            } else {
                alert('Failed to save settings.');
            }
        } catch (err) {
            console.error(err);
            alert('Error network');
        } finally {
            setSaveBusy(false);
        }
    };

    if (!boardSlug) {
        return (
            <div className="cp-shell">
                <div className="cp-empty-state">
                    <h1>Admin Dashboard</h1>
                    <p>Please navigate to a specific board, e.g. <code>/admin/boards/customervoice-features</code></p>
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="cp-shell" style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
                <div style={{ background: 'var(--cv-elevated)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--cv-border)' }}>
                    <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Admin Login</h2>
                    {authNotice && <p style={{ color: 'red', marginBottom: '1rem' }}>{authNotice}</p>}
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Workspace ID</label>
                            <input value={workspaceIdFn} onChange={e => setWorkspaceIdFn(e.target.value)} style={{ width: '100%', padding: '10px' }} required />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>User ID</label>
                            <input value={userIdFn} onChange={e => setUserIdFn(e.target.value)} style={{ width: '100%', padding: '10px' }} required />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>User Email</label>
                            <input value={userEmailFn} onChange={e => setUserEmailFn(e.target.value)} style={{ width: '100%', padding: '10px' }} required />
                        </div>
                        <button type="submit" className="hero-button">Authenticate</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="cp-shell admin-shell">
            <header className="cp-header" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <div className="cp-header-inner" style={{ padding: '0 24px' }}>
                    <div className="cp-header-brand">
                        <span className="cp-brand-name">CustomerVoice Admin</span>
                        <span className="cp-brand-sep" style={{ margin: '0 12px' }}>|</span>
                        <span className="cp-board-name" style={{ fontWeight: 'normal', opacity: 0.8 }}>{boardSlug}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="hero-button ghost" onClick={() => onNavigate(`/portal/boards/${boardSlug}`)}>View Portal</button>
                        <button className="hero-button ghost" onClick={() => setSession(null)}>Logout</button>
                    </div>
                </div>
                <div className="cp-tabs" style={{ padding: '0 24px', borderTop: 'none', background: 'var(--cv-elevated)' }}>
                    <button className={currentTab === 'settings' ? 'active' : ''} onClick={() => setCurrentTab('settings')}>Board Settings</button>
                    <button className={currentTab === 'ideas' ? 'active' : ''} onClick={() => setCurrentTab('ideas')}>Manage Ideas</button>
                    <button className={currentTab === 'changelog' ? 'active' : ''} onClick={() => setCurrentTab('changelog')}>Changelogs</button>
                </div>
            </header>

            <main style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
                {currentTab === 'settings' && (
                    <div style={{ background: 'var(--cv-elevated)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--cv-border)' }}>
                        <h2 style={{ marginBottom: '1.5rem' }}>Branding Settings</h2>
                        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="cp-form-group">
                                <label>Header Background Color</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ width: '50px', height: '40px', padding: '0' }} />
                                    <input value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ flex: 1 }} />
                                </div>
                            </div>
                            <div className="cp-form-group">
                                <label>Accent Color</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} style={{ width: '50px', height: '40px', padding: '0' }} />
                                    <input value={accentColor} onChange={e => setAccentColor(e.target.value)} style={{ flex: 1 }} />
                                </div>
                            </div>
                            <div className="cp-form-group">
                                <label>Custom Logo URL</label>
                                <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" />
                            </div>
                            <div className="cp-form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                                <input type="checkbox" id="hidePoweredBy" checked={hidePoweredBy} onChange={e => setHidePoweredBy(e.target.checked)} style={{ width: 'auto' }} />
                                <label htmlFor="hidePoweredBy" style={{ marginBottom: 0 }}>Hide "Powered by CustomerVoice"</label>
                            </div>

                            <button type="submit" className="hero-button" disabled={saveBusy} style={{ alignSelf: 'flex-start', marginTop: '12px' }}>
                                {saveBusy ? 'Saving...' : 'Save Settings'}
                            </button>
                        </form>
                    </div>
                )}

                {currentTab === 'ideas' && (
                    <div style={{ background: 'var(--cv-elevated)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--cv-border)' }}>
                        <h2 style={{ marginBottom: '1.5rem' }}>Manage Ideas</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {ideas.length === 0 ? <p style={{ color: 'var(--cv-subtle)' }}>No ideas found for this board.</p> : ideas.map(idea => (
                                <div key={idea.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--cv-bg)', border: '1px solid var(--cv-border)', borderRadius: '8px' }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: 'var(--cv-text)' }}>{idea.title}</h3>
                                        <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem', color: 'var(--cv-subtle)' }}>
                                            <span>Votes: <strong>{idea.voteCount}</strong></span>
                                            <span>Current Status: <strong style={{ textTransform: 'capitalize' }}>{idea.status.replace('_', ' ')}</strong></span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <select
                                            value={idea.status}
                                            onChange={async (e) => {
                                                const newStatus = e.target.value;
                                                const h = requestHeaders(session);
                                                try {
                                                    const res = await fetch(`${apiBase}/workspaces/${session.workspaceId}/boards/${boardId}/ideas/${idea.id}/status`, {
                                                        method: 'PATCH',
                                                        headers: h,
                                                        body: JSON.stringify({ status: newStatus })
                                                    });
                                                    if (res.ok) void loadIdeas();
                                                } catch (err) { console.error(err); }
                                            }}
                                            style={{
                                                background: 'var(--cv-elevated)',
                                                padding: '8px 12px',
                                                border: '1px solid var(--cv-border)',
                                                borderRadius: '6px',
                                                color: 'var(--cv-text)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="new">New</option>
                                            <option value="under_review">Under Review</option>
                                            <option value="planned">Planned</option>
                                            <option value="in_progress">Building (In Progress)</option>
                                            <option value="completed">Shipped (Completed)</option>
                                            <option value="declined">Declined</option>
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {currentTab === 'changelog' && (
                    <div style={{ background: 'var(--cv-elevated)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--cv-border)' }}>
                        <h2 style={{ marginBottom: '1.5rem' }}>Publish Changelog</h2>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (!session || !boardId) return;
                            setChangelogBusy(true);
                            try {
                                const h = requestHeaders(session);
                                const res = await fetch(`${apiBase}/workspaces/${session.workspaceId}/boards/${boardId}/changelogs`, {
                                    method: 'POST',
                                    headers: h,
                                    body: JSON.stringify({
                                        title: changelogTitle,
                                        body: changelogBody,
                                        entryType: changelogType
                                    })
                                });
                                if (res.ok) {
                                    alert('Changelog published!');
                                    setChangelogTitle('');
                                    setChangelogBody('');
                                } else {
                                    alert('Failed to publish changelog.');
                                }
                            } catch (err) {
                                console.error(err);
                                alert('Network error');
                            } finally {
                                setChangelogBusy(false);
                            }
                        }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="cp-form-group">
                                <label>Title</label>
                                <input value={changelogTitle} onChange={e => setChangelogTitle(e.target.value)} required placeholder="e.g. Q3 Release Notes" />
                            </div>
                            <div className="cp-form-group">
                                <label>Entry Type</label>
                                <select value={changelogType} onChange={e => setChangelogType(e.target.value as any)} style={{ padding: '10px' }}>
                                    <option value="feature">Feature</option>
                                    <option value="improvement">Improvement</option>
                                    <option value="bugfix">Bugfix</option>
                                </select>
                            </div>
                            <div className="cp-form-group">
                                <label>Body (Markdown supported)</label>
                                <div data-color-mode="light" style={{ width: '100%' }}>
                                    <MDEditor
                                        value={changelogBody}
                                        onChange={(val) => setChangelogBody(val || '')}
                                        style={{ minHeight: '300px' }}
                                    />
                                </div>
                            </div>
                            <button type="submit" className="hero-button" disabled={changelogBusy || !changelogTitle || !changelogBody} style={{ alignSelf: 'flex-start' }}>
                                {changelogBusy ? 'Publishing...' : 'Publish Changelog'}
                            </button>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
}
