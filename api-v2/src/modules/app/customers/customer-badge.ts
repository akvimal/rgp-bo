import { Profile, Segment, Tier } from './customer-relationship-rules';

/**
 * What the counter shows for a customer: a label (tier and segment, "Gold · Champion") and one line of guidance. Staff see the label and the cue, never the
 * spend or the visit counts behind them. The tone only picks a colour: "watch" is a quiet amber, never red, because the customer may be looking at the screen.
 */
export type BadgeTone = 'gold' | 'silver' | 'bronze' | 'new' | 'watch' | 'plain';

export interface Badge {
  tier: Tier;
  segment: Segment;
  dueBack: boolean;
  label: string;
  tone: BadgeTone;
  cue: string;
}

/** the segment as one customer is called, not the group */
const SINGULAR: Record<Segment, string> = {
  Champions: 'Champion', Loyal: 'Loyal', 'Big spenders': 'Big spender', Regular: 'Regular', New: 'New', 'At risk': 'At risk', Lapsed: 'Lapsed', 'No purchases': 'No purchases yet',
};

const CUES: Record<Segment, string> = {
  Champions: 'One of our best customers. Greet by name and do not keep them waiting.',
  Loyal: 'A loyal regular. Greet by name and thank them for coming back.',
  'Big spenders': 'Spends well but visits rarely. Make this visit count and mention home delivery.',
  Regular: 'A regular customer.',
  New: 'A new customer. Welcome them and make a good first impression.',
  'At risk': 'Has been away longer than usual. Ask how they have been.',
  Lapsed: 'Has not visited for a long time. Welcome them back.',
  'No purchases': 'No purchases yet.',
};

export function badgeOf(p: Pick<Profile, 'tier' | 'segment' | 'dueBack'>): Badge {
  const { tier, segment, dueBack } = p;
  const label = tier && segment !== 'No purchases' && segment !== 'Regular' ? `${tier} · ${SINGULAR[segment]}` : tier && segment === 'Regular' ? `${tier} · Regular` : SINGULAR[segment];
  const tone: BadgeTone = segment === 'At risk' || segment === 'Lapsed' ? 'watch'
    : segment === 'New' || segment === 'No purchases' ? 'new'
    : tier === 'Gold' ? 'gold' : tier === 'Silver' ? 'silver' : tier === 'Bronze' ? 'bronze' : 'plain';
  const cue = CUES[segment] + (dueBack ? ' Their usual refill may be due: ask if they need their regular items.' : '');
  return { tier, segment, dueBack, label, tone, cue };
}
