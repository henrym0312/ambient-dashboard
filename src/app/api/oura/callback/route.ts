import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  
  const tokenRes = await fetch('https://api.ouraring.com/oauth/token', {
     method: 'POST',
     headers: { 
       'Content-Type': 'application/x-www-form-urlencoded',
       'User-Agent': 'AmbientDashboard/1.0'
     },
     body: new URLSearchParams({
         grant_type: 'authorization_code',
         code: code || '',
         client_id: process.env.OURA_CLIENT_ID || '',
         client_secret: process.env.OURA_CLIENT_SECRET || '',
         redirect_uri: 'http://localhost:3000/api/oura/callback'
     })
  });
  
  const data = await tokenRes.json();
  
  if (data.access_token) {
    const tokenPath = path.join(process.cwd(), '.next', 'oura-tokens.json');
    fs.writeFileSync(tokenPath, JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + ((data.expires_in || 86400) * 1000) - 300000 // Valid for ~24 hrs
    }));
    // Automatically send you right back to your finished dashboard!
    return NextResponse.redirect('http://localhost:3000');
  }

  return NextResponse.json({ error: "Failed to get token from Oura", details: data });
}
