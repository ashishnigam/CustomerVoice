(function () {
    const currentScript = document.currentScript;
    const boardSlug = currentScript.getAttribute('data-board');
    const theme = currentScript.getAttribute('data-theme') || 'light';

    if (!boardSlug) {
        console.error('CustomerVoice Widget: Missing data-board attribute on script tag.');
        return;
    }

    const src = currentScript.src;
    const origin = new URL(src).origin;

    const iframeUrl = `${origin}/portal/boards/${boardSlug}?widget=true&theme=${theme}`;

    // Create floating button
    const btn = document.createElement('button');
    btn.innerText = 'Feedback';
    btn.style.position = 'fixed';
    btn.style.bottom = '24px';
    btn.style.right = '24px';
    btn.style.zIndex = '999999';
    btn.style.padding = '12px 24px';
    btn.style.borderRadius = '9999px';
    btn.style.background = '#6366f1';
    btn.style.color = '#ffffff';
    btn.style.border = 'none';
    btn.style.fontWeight = 'bold';
    btn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    btn.style.cursor = 'pointer';
    btn.style.transition = 'transform 0.2s';
    btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
    btn.onmouseout = () => btn.style.transform = 'scale(1)';

    // Create iframe container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.bottom = '80px';
    container.style.right = '24px';
    container.style.width = '380px';
    container.style.height = '600px';
    container.style.zIndex = '999999';
    container.style.background = '#ffffff';
    container.style.borderRadius = '12px';
    container.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
    container.style.display = 'none';
    container.style.overflow = 'hidden';

    const iframe = document.createElement('iframe');
    iframe.src = iframeUrl;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';

    container.appendChild(iframe);
    document.body.appendChild(btn);
    document.body.appendChild(container);

    let isOpen = false;
    btn.onclick = () => {
        isOpen = !isOpen;
        container.style.display = isOpen ? 'block' : 'none';
        btn.innerText = isOpen ? 'Close' : 'Feedback';
    };
})();
