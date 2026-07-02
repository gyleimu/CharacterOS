/**
 * CharacterOS — API-Only Server
 *
 * CharacterOS is an API-only single-character physics engine.
 * The V10 Core Kernel and V11 Explorer Platform are API/service-first.
 *
 * MindSpace3D 3D visualization has been retired.
 * Components preserved in src/components/mindspace/ for reference.
 * See: docs/v11.13_post_rc_hardening_report.md
 */

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '4rem auto', padding: '2rem', color: '#1a1a2e', lineHeight: 1.7 }}>
      <h1>CharacterOS</h1>
      <p>API-Only Single-Character Physics Engine</p>
      <ul>
        <li><strong>V10 Core Kernel RC</strong> — physics engine, 12 audit suites, 7 quality gates</li>
        <li><strong>V11 Explorer RC</strong> — event studio, character state, explainability, time machine</li>
      </ul>
      <p style={{ color: '#856404', background: '#fff3cd', padding: '1rem', borderRadius: 6 }}>
        This is not a chat interface. This is not a medical diagnostic tool.<br />
        CharacterOS Explorer static artifact: <code>outputs/characteros-explorer/index.html</code>
      </p>
      <p style={{ color: '#666', fontSize: '0.85rem', marginTop: '2rem' }}>
        API routes: 27 endpoints under <code>/api/</code>. See README for full documentation.
      </p>
    </main>
  );
}
