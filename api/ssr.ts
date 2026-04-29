/**
 * api/ssr.ts — Vercel serverless function for dynamic OG meta tag injection.
 *
 * Intercepts all HTML route requests (non-static-file), reads the built
 * dist/index.html, and injects route-specific og:title / og:description
 * tags before serving. For /lobby/:code routes it fetches the lobby from
 * Supabase to include the sport and game type in the preview text.
 *
 * Static assets (/assets/*, /images/*, /data/*, etc.) are served by the
 * Vercel CDN directly and never reach this function.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read the built index.html once at cold-start.
// Included in the function bundle via vercel.json > functions > includeFiles.
let baseHtml: string;
try {
  baseHtml = readFileSync(join(process.cwd(), 'dist', 'index.html'), 'utf-8');
} catch {
  // Fallback — function will still serve a minimal shell
  baseHtml = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head><body><div id="root"></div></body></html>';
}

const GAME_NAMES: Record<string, string> = {
  'lineup-is-right': 'Cap Crunch',
  'career':          'Career Arc',
  'scramble':        'Name Scramble',
  'face-reveal':     'Face Reveal',
  'roster':          'Roster Royale',
  'box-score':       'Box Score',
  'starting-lineup': 'Starting Lineup',
  'roll-call':       'Roll Call',
};

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function injectMeta(html: string, title: string, description: string): string {
  const t = escape(title);
  const d = escape(description);
  const tags = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
  ].join('\n    ');

  // Remove the existing <title> and inject all tags before </head>
  return html
    .replace(/<title>[^<]*<\/title>/, '')
    .replace('</head>', `    ${tags}\n  </head>`);
}

function staticMeta(url: string): { title: string; description: string } {
  if (url.startsWith('/lineup-is-right')) {
    return {
      title: 'Cap Crunch — BallKnowledge',
      description: 'Pick 5 player-seasons and land as close to the salary cap as possible. NBA & NFL.',
    };
  }
  if (url.startsWith('/face-reveal')) {
    return {
      title: 'Face Reveal — BallKnowledge',
      description: 'Guess the player from a zoomed-in headshot. How fast can you identify them?',
    };
  }
  if (url.startsWith('/career')) {
    return {
      title: 'Career Arc — BallKnowledge',
      description: 'Guess the NBA or NFL player from their career stat lines.',
    };
  }
  if (url.startsWith('/scramble')) {
    return {
      title: 'Name Scramble — BallKnowledge',
      description: 'Unscramble the player name before the clock runs out.',
    };
  }
  if (url.startsWith('/game') || url.startsWith('/results')) {
    return {
      title: 'Roster Royale — BallKnowledge',
      description: 'Name every player on the roster. How many can you get?',
    };
  }
  if (url.startsWith('/box-score')) {
    return {
      title: 'Box Score — BallKnowledge',
      description: 'Identify the players from an NFL box score using only jersey numbers.',
    };
  }
  if (url.startsWith('/starting-lineup')) {
    return {
      title: 'Starting Lineup — BallKnowledge',
      description: 'Name all the starters for a given NBA or NFL team.',
    };
  }
  if (url.startsWith('/roll-call')) {
    return {
      title: 'Roll Call — BallKnowledge',
      description: 'Group trivia — name every player you can think of.',
    };
  }
  if (url.startsWith('/lobby/create') || url.startsWith('/lobby/join')) {
    return {
      title: 'Create a Lobby — BallKnowledge',
      description: 'Start a multiplayer sports trivia game and invite your friends.',
    };
  }
  return {
    title: 'BallKnowledge — Sports Trivia',
    description: 'NBA & NFL sports trivia: Cap Crunch, Face Reveal, Roster Royale, Career Arc & more.',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = (req.url || '/').split('?')[0];

  let title: string;
  let description: string;
  let isLobby = false;

  // Dynamic lobby route: /lobby/:code (but not /lobby/create or /lobby/join)
  const lobbyMatch = url.match(/^\/lobby\/([A-Za-z0-9]{4,10})(?:\/.*)?$/);
  if (lobbyMatch && !url.startsWith('/lobby/create') && !url.startsWith('/lobby/join')) {
    isLobby = true;
    const code = lobbyMatch[1].toUpperCase();
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: lobby } = await supabase
          .from('lobbies')
          .select('game_type, sport')
          .eq('code', code)
          .single();

        if (lobby) {
          const sport = (lobby.sport || 'nba').toUpperCase();
          const gameName = GAME_NAMES[lobby.game_type] || 'Sports Trivia';
          title = `Join ${sport} ${gameName} — BallKnowledge`;
          description = `You've been invited to play ${sport} ${gameName}! Tap to join the lobby.`;
        } else {
          title = 'Join a Game — BallKnowledge';
          description = 'Click to join a BallKnowledge multiplayer sports trivia game.';
        }
      } else {
        ({ title, description } = staticMeta(url));
      }
    } catch {
      title = 'Join a Game — BallKnowledge';
      description = 'Click to join a BallKnowledge multiplayer sports trivia game.';
    }
  } else {
    ({ title, description } = staticMeta(url));
  }

  const finalHtml = injectMeta(baseHtml, title, description);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Lobby pages: no cache (game type/sport can change); others: cache 1hr at edge
  res.setHeader('Cache-Control', isLobby ? 'no-cache, no-store' : 's-maxage=3600, stale-while-revalidate');
  res.status(200).send(finalHtml);
}
