import type { ReactNode } from 'react';

export function Card(props: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>{props.title}</h3>
      {props.children}
    </section>
  );
}
