import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  
  const tokenRes = await fetch('https://api.ouraring.com/oauth/token', {
     method: 'POST',
     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
     body: new URLSearchParams({
         grant_type: 'authorization_code',
         code: code || '',
         client_id: process.env.OURA_CLIENT_ID || '',
         client_secret: process.env.OURA_CLIENT_SECRET || '',
         redirect_uri: 'http://localhost:3000/api/oura/callback'
     })
  });
  
  const data = await tokenRes.json();
  
  return NextResponse.json({
     STEP_1: "COPY THE REFRESH TOKEN BELOW",
     OURA_REFRESH_TOKEN: data.refresh_token,
     STEP_2: "Go to Vercel.com > Your Project > Settings > Environment Variables.",
     STEP_3: "Add/Update the variable named OURA_REFRESH_TOKEN with the string above.",
     STEP_4: "Go to the Deployments tab in Vercel and click Redeploy."
  });
}
