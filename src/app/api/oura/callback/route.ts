import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  
  try {
    const tokenRes = await fetch('https://api.ouraring.com/oauth/token', {
       method: 'POST',
       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
       body: new URLSearchParams({
           grant_type: 'authorization_code',
           code: code || '',
           client_id: process.env.OURA_CLIENT_ID || '',
           client_secret: process.env.OURA_CLIENT_SECRET || '',
           redirect_uri: 'https://ambient-dashboard-seven.vercel.app/api/oura/callback'
       })
    });
    
    const data = await tokenRes.json();
    
    if (data.refresh_token) {
       await kv.set('oura_tokens', {
         access_token: data.access_token,
         refresh_token: data.refresh_token,
         expires_at: Date.now() + ((data.expires_in || 86400) * 1000) - 300000
       });
       // Redirect straight back to your live dashboard once successful
       return NextResponse.redirect('https://ambient-dashboard-seven.vercel.app');
    }
    
    return NextResponse.json({ error: "Failed to exchange token", details: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
