import { useCallback, useEffect, useState, FormEvent } from 'react';
import MDEditor from '@uiw/react-md-editor';

type Role = 'tenant_admin' | 'workspace_admin' | 'product_manager' | 'engineering_manager' | 'contributor' | 'viewer';
type GlobalRole = 'support_admin' | 'global_admin';

type Session = {
    workspaceId: string;
    userId: string;
    userEmail: string;
    role: Role;
    accessToken: string;
    globalRole?: GlobalRole | null;
    impersonationToken?: string | null;
};

type IdeaStatus = 'new' | 'under_review' | 'accepted' | 'planned' | 'in_progress' | 'completed' | 'declined';
type ChangelogEntryType = 'feature' | 'improvement' | 'bugfix';

type Idea = {
    id: string;
    title: string;
    status: IdeaStatus;
    voteCount: number;
    createdAt: string;
};

type BoardSettings = {
    boardId: string;
    accessMode: 'public' | 'link_only' | 'private' | 'domain_restricted';
    allowedDomains: string[];
    allowedEmails: string[];
    requireAuthToVote: boolean;
    requireAuthToComment: boolean;
    requireAuthToSubmit: boolean;
    enableIdeaSubmission: boolean;
    enableCommenting: boolean;
    showVoteCount: boolean;
    portalTitle: string | null;
    welcomeMessage: string | null;
    customAccentColor: string | null;
    customLogoUrl: string | null;
    headerBgColor: string | null;
    customCss: string | null;
    fontFamily: string | null;
    hidePoweredBy: boolean;
};

type Webhook = {
    id: string;
    url: string;
    events: string[];
    secret: string;
    active: boolean;
};

type BoardInfo = {
    id: string;
    tenantId: string;
    tenantKey: string | null;
    publicBoardKey: string;
    slug: string;
    name: string;
    canonicalPath?: string;
    legacyPath?: string;
};

type TenantDomain = {
    id: string;
    domain: string;
    isPrimary: boolean;
    domainKind: 'enterprise' | 'public_email_provider' | 'alias';
    verificationStatus: 'pending' | 'verified' | 'failed' | 'blocked';
    verificationMethod: 'dns_txt' | 'email' | 'manual' | 'system';
    active: boolean;
    verification?: {
        method: 'dns_txt' | 'email' | 'manual' | 'system';
        status: 'pending' | 'verified' | 'failed' | 'blocked';
        txtName: string;
        txtValue: string | null;
        proofToken: string | null;
    };
};

type TenantSsoConnection = {
    id: string;
    provider: 'okta' | 'azure' | 'custom_saml' | 'oidc';
    domain: string;
    clientId: string | null;
    clientSecret: string | null;
    metadataUrl: string | null;
    active: boolean;
};

const defaultWorkspaceId = '22222222-2222-2222-2222-222222222222';
const defaultUserId = '33333333-3333-3333-3333-333333333333';
const defaultUserEmail = 'admin@customervoice.local';

function requestHeaders(params: Session): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-workspace-id': params.workspaceId,
        'x-user-id': params.userId,
        'x-user-email': params.userEmail,
    };
    if (params.impersonationToken) {
        headers['x-impersonation-token'] = params.impersonationToken;
    } else if (!params.globalRole) {
        headers['x-role'] = params.role;
    }
    if (params.globalRole) {
        headers['x-global-role'] = params.globalRole;
    }
    if (params.accessToken.trim().length > 0) {
        headers.authorization = `Bearer ${params.accessToken.trim()}`;
    }
    return headers;
}

function formatListInput(values: string[] | undefined): string {
    return (values ?? []).join('\n');
}

function parseListInput(value: string): string[] {
    return Array.from(
        new Set(
            value
                .split(/[\n,]/)
                .map((item) => item.trim())
                .filter((item) => item.length > 0),
        ),
    );
}

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/+$/, '');

export function AdminDashboard({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
    const parts = path.split('/');
    const boardsIdx = parts.indexOf('boards');
    const boardSlug = boardsIdx >= 0 && parts.length > boardsIdx + 1 ? parts[boardsIdx + 1] : null;

    const [session, setSession] = useState<Session | null>(null);
    const [authNotice, setAuthNotice] = useState<string | null>(null);
    const [currentTab, setCurrentTab] = useState<'settings' | 'tenant' | 'ideas' | 'changelog' | 'webhooks'>('settings');

    const [workspaceIdFn, setWorkspaceIdFn] = useState(defaultWorkspaceId);
    const [userIdFn, setUserIdFn] = useState(defaultUserId);
    const [userEmailFn, setUserEmailFn] = useState(defaultUserEmail);
    const [roleFn, setRoleFn] = useState<Role>('tenant_admin');
    const [sessionTypeFn, setSessionTypeFn] = useState<'tenant_admin' | 'support_admin'>('tenant_admin');
    const [accessTokenFn] = useState('');
    const [operatorBusy, setOperatorBusy] = useState(false);
    const [operatorNotice, setOperatorNotice] = useState<string | null>(null);

    const [boardId, setBoardId] = useState<string | null>(null);
    const [boardInfo, setBoardInfo] = useState<BoardInfo | null>(null);
    const [ideas, setIdeas] = useState<Idea[]>([]);

    const [bgColor, setBgColor] = useState('#ffffff');
    const [accentColor, setAccentColor] = useState('#000000');
    const [logoUrl, setLogoUrl] = useState('');
    const [hidePoweredBy, setHidePoweredBy] = useState(false);
    const [accessMode, setAccessMode] = useState<'public' | 'link_only' | 'private' | 'domain_restricted'>('public');
    const [requireAuthToVote, setRequireAuthToVote] = useState(false);
    const [requireAuthToComment, setRequireAuthToComment] = useState(true);
    const [requireAuthToSubmit, setRequireAuthToSubmit] = useState(true);
    const [enableIdeaSubmission, setEnableIdeaSubmission] = useState(true);
    const [enableCommenting, setEnableCommenting] = useState(true);
    const [showVoteCount, setShowVoteCount] = useState(true);
    const [portalTitle, setPortalTitle] = useState('');
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const [allowedDomainsInput, setAllowedDomainsInput] = useState('');
    const [allowedEmailsInput, setAllowedEmailsInput] = useState('');
    const [saveBusy, setSaveBusy] = useState(false);

    const [changelogTitle, setChangelogTitle] = useState('');
    const [changelogBody, setChangelogBody] = useState('');
    const [changelogType, setChangelogType] = useState<ChangelogEntryType>('feature');
    const [changelogBusy, setChangelogBusy] = useState(false);

    const [mergeModalOpen, setMergeModalOpen] = useState(false);
    const [mergeSourceIdea, setMergeSourceIdea] = useState<Idea | null>(null);
    const [mergeTargetId, setMergeTargetId] = useState('');
    const [mergeBusy, setMergeBusy] = useState(false);

    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [webhookUrl, setWebhookUrl] = useState('');
    const [webhookSecret, setWebhookSecret] = useState('');
    const [webhookEventsIdeaCreated, setWebhookEventsIdeaCreated] = useState(true);
    const [webhookEventsCommentCreated, setWebhookEventsCommentCreated] = useState(true);
    const [webhookEventsIdeaStatusUpdated, setWebhookEventsIdeaStatusUpdated] = useState(true);
    const [webhookBusy, setWebhookBusy] = useState(false);

    const [tenantDomains, setTenantDomains] = useState<TenantDomain[]>([]);
    const [tenantSsoConnections, setTenantSsoConnections] = useState<TenantSsoConnection[]>([]);
    const [tenantLoading, setTenantLoading] = useState(false);
    const [tenantDomainInput, setTenantDomainInput] = useState('');
    const [tenantDomainKind, setTenantDomainKind] = useState<'enterprise' | 'public_email_provider' | 'alias'>('enterprise');
    const [tenantDomainIsPrimary, setTenantDomainIsPrimary] = useState(false);
    const [tenantDomainBusy, setTenantDomainBusy] = useState(false);
    const [tenantSsoDomain, setTenantSsoDomain] = useState('');
    const [tenantSsoProvider, setTenantSsoProvider] = useState<'okta' | 'azure' | 'custom_saml' | 'oidc'>('custom_saml');
    const [tenantSsoMetadataUrl, setTenantSsoMetadataUrl] = useState('');
    const [tenantSsoClientId, setTenantSsoClientId] = useState('');
    const [tenantSsoClientSecret, setTenantSsoClientSecret] = useState('');
    const [tenantSsoBusy, setTenantSsoBusy] = useState(false);

    useEffect(() => {
        if (!boardSlug) return;
        const fetchBoardInfo = async () => {
            try {
                const [boardResponse, settingsResponse] = await Promise.all([
                    fetch(`${apiBase}/public/boards/${boardSlug}`),
                    fetch(`${apiBase}/public/boards/${boardSlug}/settings`),
                ]);

                if (boardResponse.ok) {
                    const data = await boardResponse.json() as BoardInfo;
                    setBoardInfo(data);
                    setBoardId(data.id);
                }

                if (settingsResponse.ok) {
                    const data = await settingsResponse.json() as BoardSettings;
                    setBoardId((current) => current ?? data.boardId);
                    setBgColor(data.headerBgColor || '#ffffff');
                    setAccentColor(data.customAccentColor || '#000000');
                    setLogoUrl(data.customLogoUrl || '');
                    setHidePoweredBy(data.hidePoweredBy || false);
                    setAccessMode(data.accessMode || 'public');
                    setRequireAuthToVote(Boolean(data.requireAuthToVote));
                    setRequireAuthToComment(Boolean(data.requireAuthToComment));
                    setRequireAuthToSubmit(Boolean(data.requireAuthToSubmit));
                    setEnableIdeaSubmission(data.enableIdeaSubmission !== false);
                    setEnableCommenting(data.enableCommenting !== false);
                    setShowVoteCount(data.showVoteCount !== false);
                    setPortalTitle(data.portalTitle || '');
                    setWelcomeMessage(data.welcomeMessage || '');
                    setAllowedDomainsInput(formatListInput(data.allowedDomains));
                    setAllowedEmailsInput(formatListInput(data.allowedEmails));
                }
            } catch (err) {
                console.error(err);
            }
        };
        void fetchBoardInfo();
    }, [boardSlug]);

    const loadIdeas = useCallback(async () => {
        if (!session || !boardId || (session.globalRole && !session.impersonationToken)) return;
        try {
            const h = requestHeaders(session);
            const res = await fetch(`${apiBase}/workspaces/${session.workspaceId}/boards/${boardId}/ideas?sort=newest`, { headers: h });
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

    const loadWebhooks = useCallback(async () => {
        if (!session || (session.globalRole && !session.impersonationToken)) return;
        try {
            const h = requestHeaders(session);
            const res = await fetch(`${apiBase}/workspaces/${session.workspaceId}/webhooks`, { headers: h });
            if (res.ok) {
                const data = await res.json();
                setWebhooks(data.items || []);
            }
        } catch (err) {
            console.error('load webhooks error', err);
        }
    }, [session]);

    useEffect(() => {
        if (session && currentTab === 'webhooks') {
            void loadWebhooks();
        }
    }, [session, currentTab, loadWebhooks]);

    const loadTenantIdentity = useCallback(async () => {
        if (!session || !boardInfo?.tenantId || (session.globalRole && !session.impersonationToken)) return;
        setTenantLoading(true);
        try {
            const h = requestHeaders(session);
            const [domainsResponse, ssoResponse] = await Promise.all([
                fetch(`${apiBase}/tenants/${boardInfo.tenantId}/domains`, { headers: h }),
                fetch(`${apiBase}/tenants/${boardInfo.tenantId}/sso-connections`, { headers: h }),
            ]);

            if (domainsResponse.ok) {
                const domainsData = await domainsResponse.json() as { items: TenantDomain[] };
                setTenantDomains(domainsData.items ?? []);
            }

            if (ssoResponse.ok) {
                const ssoData = await ssoResponse.json() as { items: TenantSsoConnection[] };
                setTenantSsoConnections(ssoData.items ?? []);
            }
        } catch (err) {
            console.error('load tenant identity error', err);
        } finally {
            setTenantLoading(false);
        }
    }, [session, boardInfo?.tenantId]);

    useEffect(() => {
        if (session && currentTab === 'tenant' && boardInfo?.tenantId) {
            void loadTenantIdentity();
        }
    }, [session, currentTab, boardInfo?.tenantId, loadTenantIdentity]);

    const portalPreviewPath = boardInfo?.canonicalPath ?? `/portal/boards/${boardSlug}`;

    const handleLogin = (e: FormEvent) => {
        e.preventDefault();
        setSession({
            workspaceId: workspaceIdFn,
            userId: userIdFn,
            userEmail: userEmailFn,
            role: roleFn,
            accessToken: accessTokenFn,
            globalRole: sessionTypeFn === 'support_admin' ? 'support_admin' : null,
            impersonationToken: null,
        });
        setAuthNotice(null);
        setOperatorNotice(null);
    };

    const handleSwitchTenant = useCallback(async () => {
        if (!session?.globalRole || !boardInfo?.tenantId) return;
        setOperatorBusy(true);
        setOperatorNotice(null);
        try {
            const res = await fetch(`${apiBase}/operator/tenants/${boardInfo.tenantId}/impersonate`, {
                method: 'POST',
                headers: requestHeaders(session),
                body: JSON.stringify({ assumedRole: 'tenant_admin' }),
            });
            if (!res.ok) {
                const data = await res.json();
                setOperatorNotice(data.error ?? 'Failed to switch tenant');
                return;
            }

            const data = await res.json() as {
                workspace: { id: string };
                impersonation: { sessionToken: string; assumedRole: Role };
            };

            setSession((current) => current ? ({
                ...current,
                workspaceId: data.workspace.id,
                role: data.impersonation.assumedRole,
                impersonationToken: data.impersonation.sessionToken,
            }) : current);
            setOperatorNotice('Tenant impersonation active');
        } catch (error) {
            console.error(error);
            setOperatorNotice('Failed to switch tenant');
        } finally {
            setOperatorBusy(false);
        }
    }, [boardInfo?.tenantId, session]);

    const handleEndImpersonation = useCallback(async () => {
        if (!session?.globalRole || !session.impersonationToken) return;
        setOperatorBusy(true);
        try {
            await fetch(`${apiBase}/operator/impersonations/revoke`, {
                method: 'POST',
                headers: requestHeaders(session),
                body: JSON.stringify({ sessionToken: session.impersonationToken }),
            });
        } catch (error) {
            console.error(error);
        } finally {
            setSession((current) => current ? ({
                ...current,
                workspaceId: workspaceIdFn,
                impersonationToken: null,
                role: roleFn,
            }) : current);
            setOperatorNotice('Tenant impersonation ended');
            setOperatorBusy(false);
        }
    }, [roleFn, session, workspaceIdFn]);

    const handleLogout = useCallback(async () => {
        if (session?.globalRole && session.impersonationToken) {
            try {
                await fetch(`${apiBase}/operator/impersonations/revoke`, {
                    method: 'POST',
                    headers: requestHeaders(session),
                    body: JSON.stringify({ sessionToken: session.impersonationToken }),
                });
            } catch (error) {
                console.error(error);
            }
        }

        setSession(null);
        setOperatorNotice(null);
    }, [session]);

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
                    accessMode,
                    requireAuthToVote,
                    requireAuthToComment,
                    requireAuthToSubmit,
                    enableIdeaSubmission,
                    enableCommenting,
                    showVoteCount,
                    allowedDomains: parseListInput(allowedDomainsInput),
                    allowedEmails: parseListInput(allowedEmailsInput),
                    portalTitle: portalTitle.trim() || null,
                    welcomeMessage: welcomeMessage.trim() || null,
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

    const handleMergeIdea = async () => {
        if (!session || !boardId || !mergeSourceIdea || !mergeTargetId) return;
        setMergeBusy(true);
        try {
            const h = requestHeaders(session);
            const res = await fetch(`${apiBase}/workspaces/${session.workspaceId}/boards/${boardId}/ideas/${mergeSourceIdea.id}/merge`, {
                method: 'POST',
                headers: h,
                body: JSON.stringify({ targetIdeaId: mergeTargetId })
            });

            if (res.ok) {
                alert('Idea successfully merged!');
                setMergeModalOpen(false);
                setMergeSourceIdea(null);
                setMergeTargetId('');
                void loadIdeas();
            } else {
                const data = await res.json();
                alert(`Merge failed: ${data.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error(err);
            alert('Network error merging idea');
        } finally {
            setMergeBusy(false);
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
                            <label htmlFor="admin-session-type" style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Session Type</label>
                            <select id="admin-session-type" value={sessionTypeFn} onChange={e => setSessionTypeFn(e.target.value as 'tenant_admin' | 'support_admin')} style={{ width: '100%', padding: '10px' }}>
                                <option value="tenant_admin">tenant_admin</option>
                                <option value="support_admin">support_admin</option>
                            </select>
                        </div>
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
                        {sessionTypeFn === 'tenant_admin' ? (
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Role</label>
                                <select value={roleFn} onChange={e => setRoleFn(e.target.value as Role)} style={{ width: '100%', padding: '10px' }}>
                                    <option value="tenant_admin">tenant_admin</option>
                                    <option value="workspace_admin">workspace_admin</option>
                                    <option value="product_manager">product_manager</option>
                                    <option value="engineering_manager">engineering_manager</option>
                                    <option value="contributor">contributor</option>
                                    <option value="viewer">viewer</option>
                                </select>
                            </div>
                        ) : null}
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
                        <span style={{ alignSelf: 'center', color: 'var(--cv-subtle)', fontSize: '0.9rem' }}>
                            {session.globalRole ? `${session.globalRole}${session.impersonationToken ? ` -> ${session.role}` : ''}` : session.role}
                        </span>
                        {session.globalRole ? (
                            session.impersonationToken ? (
                                <button className="hero-button ghost" onClick={handleEndImpersonation} disabled={operatorBusy}>
                                    End Tenant Session
                                </button>
                            ) : (
                                <button className="hero-button ghost" onClick={handleSwitchTenant} disabled={operatorBusy || !boardInfo?.tenantId}>
                                    Switch To Board Tenant
                                </button>
                            )
                        ) : null}
                        <button className="hero-button ghost" onClick={() => onNavigate(portalPreviewPath)}>View Portal</button>
                        <button className="hero-button ghost" onClick={() => void handleLogout()}>Logout</button>
                    </div>
                </div>
                {operatorNotice ? (
                    <div style={{ padding: '8px 24px', borderTop: '1px solid var(--cv-border)', color: 'var(--cv-subtle)', fontSize: '0.9rem' }}>
                        {operatorNotice}
                    </div>
                ) : null}
                <div className="cp-tabs" style={{ padding: '0 24px', borderTop: 'none', background: 'var(--cv-elevated)' }}>
                    <button className={currentTab === 'settings' ? 'active' : ''} onClick={() => setCurrentTab('settings')}>Board Settings</button>
                    <button className={currentTab === 'tenant' ? 'active' : ''} onClick={() => setCurrentTab('tenant')}>Tenant Identity</button>
                    <button className={currentTab === 'ideas' ? 'active' : ''} onClick={() => setCurrentTab('ideas')}>Manage Ideas</button>
                    <button className={currentTab === 'changelog' ? 'active' : ''} onClick={() => setCurrentTab('changelog')}>Changelogs</button>
                    <button className={currentTab === 'webhooks' ? 'active' : ''} onClick={() => setCurrentTab('webhooks')}>Webhooks</button>
                </div>
            </header>

            <main style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
                {session.globalRole && !session.impersonationToken ? (
                    <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '12px', border: '1px solid var(--cv-border)', background: 'var(--cv-elevated)' }}>
                        <strong>Support Admin Session</strong>
                        <p style={{ color: 'var(--cv-subtle)', margin: '8px 0 0' }}>
                            Switch into the board tenant before using tenant-scoped admin routes. This keeps support access explicit and auditable.
                        </p>
                    </div>
                ) : null}

                {currentTab === 'settings' && (
                    <div style={{ background: 'var(--cv-elevated)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--cv-border)' }}>
                        <h2 style={{ marginBottom: '1.5rem' }}>Portal Settings</h2>
                        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="cp-form-group">
                                <label>Access Mode</label>
                                <select value={accessMode} onChange={e => setAccessMode(e.target.value as 'public' | 'link_only' | 'private' | 'domain_restricted')}>
                                    <option value="public">Public</option>
                                    <option value="link_only">Link Only</option>
                                    <option value="private">Private</option>
                                    <option value="domain_restricted">Domain Restricted</option>
                                </select>
                            </div>
                            {accessMode === 'domain_restricted' ? (
                                <>
                                    <div className="cp-form-group">
                                        <label>Allowed Email Domains</label>
                                        <textarea
                                            value={allowedDomainsInput}
                                            onChange={e => setAllowedDomainsInput(e.target.value)}
                                            rows={4}
                                            placeholder={'company.com\npartner.org'}
                                        />
                                        <small style={{ color: 'var(--cv-subtle)' }}>
                                            One domain per line or comma-separated. Users with matching work emails can access the board.
                                        </small>
                                    </div>
                                    <div className="cp-form-group">
                                        <label>Allowed Email Addresses</label>
                                        <textarea
                                            value={allowedEmailsInput}
                                            onChange={e => setAllowedEmailsInput(e.target.value)}
                                            rows={4}
                                            placeholder={'vip@partner.com\nadvisor@example.com'}
                                        />
                                        <small style={{ color: 'var(--cv-subtle)' }}>
                                            Optional exact-email allowlist for exceptions outside the primary domain list.
                                        </small>
                                    </div>
                                </>
                            ) : null}
                            <div className="cp-form-group">
                                <label>Portal Title</label>
                                <input value={portalTitle} onChange={e => setPortalTitle(e.target.value)} placeholder="Customer Feedback Portal" />
                            </div>
                            <div className="cp-form-group">
                                <label>Welcome Message</label>
                                <textarea value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} rows={3} placeholder="Share your ideas and vote on what we build next." />
                            </div>
                            <div className="cp-form-group" style={{ gap: '10px' }}>
                                <label style={{ marginBottom: '4px' }}>Interaction Controls</label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                                    <input type="checkbox" checked={requireAuthToVote} onChange={e => setRequireAuthToVote(e.target.checked)} style={{ width: 'auto' }} />
                                    Require auth to vote
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                                    <input type="checkbox" checked={requireAuthToComment} onChange={e => setRequireAuthToComment(e.target.checked)} style={{ width: 'auto' }} />
                                    Require auth to comment
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                                    <input type="checkbox" checked={requireAuthToSubmit} onChange={e => setRequireAuthToSubmit(e.target.checked)} style={{ width: 'auto' }} />
                                    Require auth to submit ideas
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                                    <input type="checkbox" checked={enableIdeaSubmission} onChange={e => setEnableIdeaSubmission(e.target.checked)} style={{ width: 'auto' }} />
                                    Enable idea submission
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                                    <input type="checkbox" checked={enableCommenting} onChange={e => setEnableCommenting(e.target.checked)} style={{ width: 'auto' }} />
                                    Enable commenting
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }}>
                                    <input type="checkbox" checked={showVoteCount} onChange={e => setShowVoteCount(e.target.checked)} style={{ width: 'auto' }} />
                                    Show vote counts
                                </label>
                            </div>
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

                {currentTab === 'tenant' && (
                    <div style={{ display: 'grid', gap: '24px' }}>
                        <div style={{ background: 'var(--cv-elevated)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--cv-border)' }}>
                            <h2 style={{ marginBottom: '0.75rem' }}>Tenant Identity</h2>
                            <p style={{ color: 'var(--cv-subtle)', marginBottom: '1.5rem' }}>
                                Manage verified company domains and tenant-owned SSO configuration for this board&apos;s parent tenant.
                            </p>
                            <div style={{ display: 'grid', gap: '10px', fontSize: '0.95rem' }}>
                                <div><strong>Tenant ID:</strong> {boardInfo?.tenantId ?? 'Unavailable'}</div>
                                <div><strong>Tenant Key:</strong> {boardInfo?.tenantKey ?? 'Unavailable'}</div>
                                <div><strong>Public Board Key:</strong> {boardInfo?.publicBoardKey ?? 'Unavailable'}</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
                            <div style={{ background: 'var(--cv-elevated)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--cv-border)' }}>
                                <h3 style={{ marginBottom: '1rem' }}>Tenant Domains</h3>
                                <form
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        if (!session || !boardInfo?.tenantId || tenantDomainInput.trim().length === 0) return;
                                        setTenantDomainBusy(true);
                                        try {
                                            const h = requestHeaders(session);
                                            const res = await fetch(`${apiBase}/tenants/${boardInfo.tenantId}/domains`, {
                                                method: 'POST',
                                                headers: h,
                                                body: JSON.stringify({
                                                    domain: tenantDomainInput.trim(),
                                                    domainKind: tenantDomainKind,
                                                    isPrimary: tenantDomainIsPrimary,
                                                }),
                                            });
                                            if (res.ok) {
                                                setTenantDomainInput('');
                                                setTenantDomainKind('enterprise');
                                                setTenantDomainIsPrimary(false);
                                                await loadTenantIdentity();
                                            } else {
                                                alert('Failed to add tenant domain.');
                                            }
                                        } catch (err) {
                                            console.error(err);
                                            alert('Network error while adding tenant domain.');
                                        } finally {
                                            setTenantDomainBusy(false);
                                        }
                                    }}
                                    style={{ display: 'grid', gap: '12px', marginBottom: '1.5rem' }}
                                >
                                    <div className="cp-form-group">
                                        <label>Domain</label>
                                        <input
                                            value={tenantDomainInput}
                                            onChange={(e) => setTenantDomainInput(e.target.value)}
                                            placeholder="identity.example.com"
                                            required
                                        />
                                    </div>
                                    <div className="cp-form-group">
                                        <label>Domain Type</label>
                                        <select value={tenantDomainKind} onChange={(e) => setTenantDomainKind(e.target.value as TenantDomain['domainKind'])}>
                                            <option value="enterprise">Enterprise</option>
                                            <option value="alias">Alias</option>
                                            <option value="public_email_provider">Public Email Provider</option>
                                        </select>
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            checked={tenantDomainIsPrimary}
                                            onChange={(e) => setTenantDomainIsPrimary(e.target.checked)}
                                            style={{ width: 'auto' }}
                                        />
                                        Mark as primary identity domain
                                    </label>
                                    <button type="submit" className="hero-button" disabled={tenantDomainBusy || !boardInfo?.tenantId}>
                                        {tenantDomainBusy ? 'Adding...' : 'Add Domain'}
                                    </button>
                                </form>

                                {tenantLoading ? <p style={{ color: 'var(--cv-subtle)' }}>Loading domains...</p> : null}
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    {tenantDomains.length === 0 ? (
                                        <p style={{ color: 'var(--cv-subtle)' }}>No tenant domains configured yet.</p>
                                    ) : tenantDomains.map((domain) => (
                                        <div key={domain.id} style={{ padding: '14px', background: 'var(--cv-bg)', border: '1px solid var(--cv-border)', borderRadius: '8px' }}>
                                            <div style={{ display: 'grid', gap: '12px' }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <strong>{domain.domain}</strong>
                                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px', fontSize: '0.85rem', color: 'var(--cv-subtle)' }}>
                                                        <span>{domain.domainKind}</span>
                                                        <span>{domain.verificationStatus}</span>
                                                        <span>{domain.verificationMethod}</span>
                                                        {domain.isPrimary ? <span>primary</span> : null}
                                                        <span>{domain.active ? 'active' : 'inactive'}</span>
                                                    </div>
                                                    {domain.verification?.txtValue ? (
                                                        <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--cv-subtle)' }}>
                                                            <div><strong>DNS TXT:</strong> {domain.verification.txtName}</div>
                                                            <code style={{ display: 'block', marginTop: '6px', whiteSpace: 'normal' }}>{domain.verification.txtValue}</code>
                                                        </div>
                                                    ) : null}
                                                </div>
                                                {domain.verificationStatus !== 'verified' ? (
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                        <button
                                                            type="button"
                                                            className="hero-button ghost"
                                                            aria-label={`Verify domain ${domain.domain}`}
                                                            onClick={async () => {
                                                                if (!session || !boardInfo?.tenantId || !domain.verification?.proofToken) return;
                                                                try {
                                                                    const h = requestHeaders(session);
                                                                    const res = await fetch(`${apiBase}/tenants/${boardInfo.tenantId}/domains/${domain.id}/verify`, {
                                                                        method: 'POST',
                                                                        headers: h,
                                                                        body: JSON.stringify({ proofToken: domain.verification.proofToken }),
                                                                    });
                                                                    if (res.ok) {
                                                                        await loadTenantIdentity();
                                                                    } else {
                                                                        alert('Failed to verify tenant domain.');
                                                                    }
                                                                } catch (err) {
                                                                    console.error(err);
                                                                    alert('Network error while verifying tenant domain.');
                                                                }
                                                            }}
                                                        >
                                                            Verify Domain
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ background: 'var(--cv-elevated)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--cv-border)' }}>
                                <h3 style={{ marginBottom: '1rem' }}>Tenant SSO Readiness</h3>
                                <form
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        if (!session || !boardInfo?.tenantId || tenantSsoDomain.trim().length === 0) return;
                                        setTenantSsoBusy(true);
                                        try {
                                            const h = requestHeaders(session);
                                            const res = await fetch(`${apiBase}/tenants/${boardInfo.tenantId}/sso-connections`, {
                                                method: 'POST',
                                                headers: h,
                                                body: JSON.stringify({
                                                    provider: tenantSsoProvider,
                                                    domain: tenantSsoDomain.trim(),
                                                    metadataUrl: tenantSsoMetadataUrl.trim() || null,
                                                    clientId: tenantSsoClientId.trim() || null,
                                                    clientSecret: tenantSsoClientSecret.trim() || null,
                                                    active: true,
                                                }),
                                            });
                                            if (res.ok) {
                                                setTenantSsoDomain('');
                                                setTenantSsoProvider('custom_saml');
                                                setTenantSsoMetadataUrl('');
                                                setTenantSsoClientId('');
                                                setTenantSsoClientSecret('');
                                                await loadTenantIdentity();
                                            } else {
                                                alert('Failed to add tenant SSO connection.');
                                            }
                                        } catch (err) {
                                            console.error(err);
                                            alert('Network error while adding tenant SSO connection.');
                                        } finally {
                                            setTenantSsoBusy(false);
                                        }
                                    }}
                                    style={{ display: 'grid', gap: '12px', marginBottom: '1.5rem' }}
                                >
                                    <div className="cp-form-group">
                                        <label>Provider</label>
                                        <select value={tenantSsoProvider} onChange={(e) => setTenantSsoProvider(e.target.value as TenantSsoConnection['provider'])}>
                                            <option value="custom_saml">custom_saml</option>
                                            <option value="okta">okta</option>
                                            <option value="azure">azure</option>
                                            <option value="oidc">oidc</option>
                                        </select>
                                    </div>
                                    <div className="cp-form-group">
                                        <label>Domain</label>
                                        <input
                                            value={tenantSsoDomain}
                                            onChange={(e) => setTenantSsoDomain(e.target.value)}
                                            placeholder="identity.example.com"
                                            required
                                        />
                                    </div>
                                    <div className="cp-form-group">
                                        <label>Metadata URL</label>
                                        <input
                                            value={tenantSsoMetadataUrl}
                                            onChange={(e) => setTenantSsoMetadataUrl(e.target.value)}
                                            placeholder="https://idp.example.com/metadata"
                                        />
                                    </div>
                                    <div className="cp-form-group">
                                        <label>Client ID</label>
                                        <input value={tenantSsoClientId} onChange={(e) => setTenantSsoClientId(e.target.value)} placeholder="Optional" />
                                    </div>
                                    <div className="cp-form-group">
                                        <label>Client Secret</label>
                                        <input value={tenantSsoClientSecret} onChange={(e) => setTenantSsoClientSecret(e.target.value)} placeholder="Optional" />
                                    </div>
                                    <button type="submit" className="hero-button" disabled={tenantSsoBusy || !boardInfo?.tenantId}>
                                        {tenantSsoBusy ? 'Adding...' : 'Add Tenant SSO'}
                                    </button>
                                </form>

                                {tenantLoading ? <p style={{ color: 'var(--cv-subtle)' }}>Loading SSO connections...</p> : null}
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    {tenantSsoConnections.length === 0 ? (
                                        <p style={{ color: 'var(--cv-subtle)' }}>No tenant SSO connections configured yet.</p>
                                    ) : tenantSsoConnections.map((connection) => (
                                        <div key={connection.id} style={{ padding: '14px', background: 'var(--cv-bg)', border: '1px solid var(--cv-border)', borderRadius: '8px' }}>
                                            <strong>{connection.domain}</strong>
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px', fontSize: '0.85rem', color: 'var(--cv-subtle)' }}>
                                                <span>{connection.provider}</span>
                                                <span>{connection.active ? 'active' : 'inactive'}</span>
                                                {connection.metadataUrl ? <span>{connection.metadataUrl}</span> : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
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
                                        <button
                                            className="hero-button ghost"
                                            style={{ color: 'var(--cv-subtle)', padding: '8px 12px' }}
                                            onClick={() => {
                                                setMergeSourceIdea(idea);
                                                setMergeModalOpen(true);
                                                setMergeTargetId('');
                                            }}
                                        >
                                            Merge
                                        </button>
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
                                <select value={changelogType} onChange={e => setChangelogType(e.target.value as ChangelogEntryType)} style={{ padding: '10px' }}>
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

                {currentTab === 'webhooks' && (
                    <div style={{ background: 'var(--cv-elevated)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--cv-border)' }}>
                        <h2 style={{ marginBottom: '1.5rem' }}>Workspace Integrations &amp; Webhooks</h2>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (!session) return;
                            setWebhookBusy(true);
                            try {
                                const h = requestHeaders(session);
                                const events = [];
                                if (webhookEventsIdeaCreated) events.push('idea.created');
                                if (webhookEventsCommentCreated) events.push('comment.created');
                                if (webhookEventsIdeaStatusUpdated) events.push('idea.status.updated');

                                const res = await fetch(`${apiBase}/workspaces/${session.workspaceId}/webhooks`, {
                                    method: 'POST',
                                    headers: h,
                                    body: JSON.stringify({
                                        url: webhookUrl,
                                        secret: webhookSecret || crypto.randomUUID(),
                                        events,
                                        active: true
                                    })
                                });
                                if (res.ok) {
                                    setWebhookUrl('');
                                    setWebhookSecret('');
                                    void loadWebhooks();
                                } else {
                                    alert('Failed to save webhook');
                                }
                            } catch (err) {
                                console.error(err);
                            } finally {
                                setWebhookBusy(false);
                            }
                        }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div className="cp-form-group">
                                <label>Webhook URL</label>
                                <input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} required placeholder="https://external-api.com/webhook" />
                            </div>
                            <div className="cp-form-group">
                                <label>Secret (Optional)</label>
                                <input value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} placeholder="crypto.randomUUID() chosen by default if empty" />
                            </div>
                            <div className="cp-form-group">
                                <label>Subscribe to Events</label>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <label style={{ display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={webhookEventsIdeaCreated} onChange={e => setWebhookEventsIdeaCreated(e.target.checked)} />
                                        idea.created
                                    </label>
                                    <label style={{ display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={webhookEventsCommentCreated} onChange={e => setWebhookEventsCommentCreated(e.target.checked)} />
                                        comment.created
                                    </label>
                                    <label style={{ display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={webhookEventsIdeaStatusUpdated} onChange={e => setWebhookEventsIdeaStatusUpdated(e.target.checked)} />
                                        idea.status.updated
                                    </label>
                                </div>
                            </div>
                            <button type="submit" className="hero-button" disabled={webhookBusy || !webhookUrl} style={{ alignSelf: 'flex-start' }}>
                                {webhookBusy ? 'Saving...' : 'Add Webhook'}
                            </button>
                        </form>

                        <h3>Active Webhooks</h3>
                        {webhooks.length === 0 ? <p style={{ color: 'var(--cv-subtle)' }}>No webhooks configured.</p> : webhooks.map(wh => (
                            <div key={wh.id} style={{ padding: '16px', background: 'var(--cv-bg)', border: '1px solid var(--cv-border)', borderRadius: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem' }}>{wh.url}</h4>
                                    <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', color: 'var(--cv-subtle)' }}>
                                        <span>Status: {wh.active ? '🟢 Active' : '🔴 Inactive'}</span>
                                        <span>Events: {wh.events?.join(', ') || 'None'}</span>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--cv-subtle)', marginTop: '4px' }}>Secret: <code>{wh.secret}</code></div>
                                </div>
                                <button type="button" className="hero-button ghost" style={{ color: '#d9534f' }} onClick={async () => {
                                    if (!window.confirm('Delete this webhook permanently?')) return;
                                    try {
                                        const h = requestHeaders(session);
                                        const res = await fetch(`${apiBase}/workspaces/${session.workspaceId}/webhooks/${wh.id}`, { method: 'DELETE', headers: h });
                                        if (res.ok) void loadWebhooks();
                                    } catch (err) { console.error(err); }
                                }}>Delete</button>
                            </div>
                        ))}
                    </div>
                )}

            </main>

            {mergeModalOpen && mergeSourceIdea && (
                <div className="cp-modal-overlay">
                    <div className="cp-modal-content">
                        <h2>Merge Idea</h2>
                        <p style={{ color: 'var(--cv-subtle)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                            You are merging <strong>"{mergeSourceIdea.title}"</strong> into another idea.
                            This will combine all votes, comments, and attachments into the target idea, and mark this one as declined.
                            This action cannot be cleanly undone.
                        </p>

                        <div className="cp-form-group">
                            <label>Target Idea</label>
                            <select
                                value={mergeTargetId}
                                onChange={(e) => setMergeTargetId(e.target.value)}
                                style={{ padding: '10px' }}
                            >
                                <option value="" disabled>Select an idea...</option>
                                {ideas.filter(i => i.id !== mergeSourceIdea.id && i.status !== 'declined').map(idea => (
                                    <option key={idea.id} value={idea.id}>{idea.title}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                            <button className="hero-button ghost" onClick={() => setMergeModalOpen(false)}>Cancel</button>
                            <button
                                className="hero-button"
                                disabled={mergeBusy || !mergeTargetId}
                                onClick={handleMergeIdea}
                                style={{ background: '#d9534f' }}
                            >
                                {mergeBusy ? 'Merging...' : 'Merge permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
