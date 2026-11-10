import { NextResponse, connection } from 'next/server';

export async function GET() {
  await connection();
  const clientId = process.env.OURA_CLIENT_ID;
  const redirectUri = 'https://ambient-dashboard-seven.vercel.app/api/oura/callback';
  const authUrl = `https://cloud.ouraring.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=daily`;
  return NextResponse.redirect(authUrl);
}
