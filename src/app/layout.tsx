import type { Metadata } from 'next';
import './globals.css';
import './arena.css';
import './workshop.css';
import './court.css';
import './journey.css';
import './lobby.css';
import './steps.css';
import './project-flow.css';
export const metadata: Metadata = { title: 'Vibe — 생각에서 시작하는 변화', description: '함께 발견하고, 만들고, 연결하는 4주 바이브코딩 워크숍' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="ko"><body>{children}</body></html>;
}
