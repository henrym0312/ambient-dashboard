import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.OURA_CLIENT_ID;
  const redirectUri = 'http://localhost:3000/api/oura/callback';
  const authUrl = `https://cloud.ouraring.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=daily`;
  return NextResponse.redirect(authUrl);
}
