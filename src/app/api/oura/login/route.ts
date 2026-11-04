import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const _skipPrerender = new URL(req.url);
  const clientId = process.env.OURA_CLIENT_ID;
  const redirectUri = 'https://ambient-dashboard-seven.vercel.app/api/oura/callback';
  const authUrl = `https://cloud.ouraring.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=daily`;
  return NextResponse.redirect(authUrl);
}
