import { NavGroup, NavItem, NavItemId, NAV_GROUPS } from './dash-nav';
import { environment } from '../environments/environment';

export type FaqTopic = 'general' | NavItemId;

export interface FaqLink {
  readonly label: string;
  readonly url: string;
}

export interface FaqEntry {
  readonly id: string;
  readonly topic: FaqTopic;
  readonly question: string;
  readonly answer: string;
  readonly details: readonly string[];
  readonly link?: FaqLink;
  readonly added: string;
}

export interface FaqQuery {
  readonly topic: FaqTopic | null;
  readonly search: string;
}

export interface FaqTopicMeta {
  readonly id: FaqTopic;
  readonly label: string;
  readonly icon: string;
  readonly outlined?: boolean;
  readonly mask?: string;
}

export interface FaqTopicGroup {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly topics: readonly FaqTopicMeta[];
}

export interface FaqSection {
  readonly topic: FaqTopicMeta;
  readonly entries: readonly FaqEntry[];
}

export const GENERAL_TOPIC: FaqTopicMeta = {
  id: 'general',
  label: 'General',
  icon: 'help_outline',
};

function topicOf(item: NavItem): FaqTopicMeta {
  return { id: item.id, label: item.label, icon: item.icon, outlined: item.outlined, mask: item.mask };
}

export const FAQ_TOPIC_GROUPS: readonly FaqTopicGroup[] = NAV_GROUPS.map((group: NavGroup): FaqTopicGroup => ({
  id: group.id,
  label: group.label,
  icon: group.icon,
  topics: group.items.map(topicOf),
}));

const TOPICS_BY_ID: ReadonlyMap<FaqTopic, FaqTopicMeta> = new Map<FaqTopic, FaqTopicMeta>([
  [GENERAL_TOPIC.id, GENERAL_TOPIC],
  ...NAV_GROUPS.flatMap((group: NavGroup): [FaqTopic, FaqTopicMeta][] =>
    group.items.map((item: NavItem): [FaqTopic, FaqTopicMeta] => [item.id, topicOf(item)])),
]);

export function topicMeta(topic: FaqTopic): FaqTopicMeta {
  return TOPICS_BY_ID.get(topic) ?? GENERAL_TOPIC;
}

export function isFaqTopic(value: string | null | undefined): value is FaqTopic {
  return value != null && TOPICS_BY_ID.has(value as FaqTopic);
}

export const FAQ_ENTRIES: readonly FaqEntry[] = [
  {
    id: 'what-is-yeppbot',
    topic: 'general',
    added: '2026-08-03',
    question: 'What is YEPPBot?',
    answer: 'A Twitch chatbot that answers commands, manages your VIPs and moderators, and keeps your community entertained while you stream.',
    details: [
      'It runs as a single hosted instance, so there is nothing for you to install or keep online. You invite it into your channel, and it is there the next time you go live.',
      'YEPPBot has been around as a beta project for a long time. What is new is this dashboard, which is how you configure it without memorizing chat commands.',
    ],
  },
  {
    id: 'yeppdash-vs-yeppbot',
    topic: 'general',
    added: '2026-08-03',
    question: 'What is YEPPDash, and how is it different from the bot?',
    answer: 'YEPPDash is the web dashboard you are on right now. It is the control panel for YEPPBot, not the bot itself.',
    details: [
      'The bot has no console and no settings screen of its own. Everything it knows lives in a database, and until now the only way to change any of it was through chat commands.',
      'The dashboard talks to its own backend, which talks to the bot. You never talk to the bot directly, which is exactly the point: the bot keeps a tiny set of inputs and stays hard to attack.',
    ],
  },
  {
    id: 'invite-the-bot',
    topic: 'general',
    added: '2026-08-03',
    question: 'How do I get the bot into my channel?',
    answer: 'Log in with Twitch, open the dashboard, and hit join. The bot is in your chat a moment later.',
    details: [
      'You can send it away again from the same place. Nothing is deleted when you do, so your commands, quotes, and birthdays are still there if you invite it back.',
      'The bot needs to be a moderator in your channel for some features, timeouts, and shoutouts in particular. It works without that, it just does less.',
    ],
  },
  {
    id: 'does-it-cost-anything',
    topic: 'general',
    added: '2026-08-03',
    question: 'Does it cost anything?',
    answer: 'No. YEPPBot and YEPPDash are free, with no paid tier, no ads, and no feature held back behind a subscription.',
    details: [
      'This is a hobby project, not a business. There is no plan to monetize it, and none to put the interesting parts behind a price later.',
    ],
  },
  {
    id: 'twitch-login',
    topic: 'general',
    added: '2026-08-03',
    question: 'What happens when I log in with Twitch?',
    answer: 'You are sent to Twitch, you approve the access there, and Twitch sends you back. YEPPDash never sees your password.',
    details: [
      'There is no YEPPDash account and no password to pick. Your Twitch identity is the only login, and the access token that comes back is stored encrypted.',
      'The token is what lets the dashboard read your followers and change your moderators and VIPs on your behalf. Revoking access to your Twitch settings cuts that off immediately.',
    ],
    link: {
      label: 'Read the privacy policy',
      url: `${environment.marketingBaseUrl}/privacy`,
    },
  },
  {
    id: 'where-is-it-hosted',
    topic: 'general',
    added: '2026-08-03',
    question: 'Where is all of this hosted?',
    answer: 'On dedicated Hetzner servers inside the EU, so EU data protection law and the GDPR apply to the whole thing.',
    details: [
      'Dedicated machines rather than shared hosting, with the database, the backend and this site all in one place.',
      'Nothing is reachable directly: every request passes a reverse proxy, with Cloudflare in front of it keeping the real addresses out of sight.',
    ],
  },
  {
    id: 'which-features-work',
    topic: 'general',
    added: '2026-08-03',
    question: 'Which features actually work right now?',
    answer: 'Bot join and leave, moderator and VIP management, quotes, follower birthdays, BDSM test results, auto-shoutouts for raids, the channel point timeout reward and channel point giveaways are all live. Custom commands work but are still buggy.',
    details: [
      'The landing page carries a badge next to each feature saying how far along it is. Anything marked "Coming soon" is genuinely not built yet rather than hidden somewhere.',
    ],
  },
  {
    id: 'how-stable',
    topic: 'general',
    added: '2026-08-03',
    question: 'How stable is this? Can I lose my data?',
    answer: 'Both the bot and the dashboard run stably in practice, but this is early beta software with no uptime guarantee and no promise that data cannot be lost.',
    details: [
      'The dashboard only launched at the end of July 2026. The design will change significantly, and bugs almost certainly exist in corners that have not been walked through yet.',
      'If a set of quotes or commands genuinely hurts to lose, export it. The quote list has an Excel export for exactly that reason.',
    ],
  },
  {
    id: 'report-a-bug',
    topic: 'general',
    added: '2026-08-03',
    question: 'I found a bug, or I want a feature. What do I do?',
    answer: 'Open an issue on GitHub. Bug reports and feature requests both go in the same place, and both are read.',
    details: [
      'For a bug, the useful things to include are what you clicked, what you expected, and what happened instead. A screenshot beats a description.',
      'Pull requests are welcome too, if you would rather build the thing than wait for it.',
    ],
    link: {
      label: 'Open an issue on GitHub',
      url: 'https://github.com/MCmoderSD/YEPPDash/issues',
    },
  },
  {
    id: 'who-builds-this',
    topic: 'general',
    added: '2026-08-03',
    question: 'Who builds and runs this?',
    answer: 'One person: Seraphin Berger, better known as MCmoderSD. The bot, this dashboard, and the backend between them are all solo-developed.',
    details: [
      'Worth knowing, because it cuts both ways: nobody is on call and answers arrive when there is time for them, but a bug report lands directly with the person who wrote the code.',
    ],
    link: {
      label: 'Imprint and contact details',
      url: `${environment.marketingBaseUrl}/imprint`,
    },
  },
  {
    id: 'open-source',
    topic: 'general',
    added: '2026-08-03',
    question: 'Is it open source?',
    answer: 'Yes. The bot and the dashboard are both public on GitHub under the BSD 3-Clause license, and they will stay that way.',
    details: [
      'You can read exactly what the bot does with your channel and what the dashboard does with your token, rather than taking anyone\'s word for it.',
      'You can also run your own instance if you would rather not depend on the hosted one.',
    ],
    link: {
      label: 'YEPPDash on GitHub',
      url: 'https://github.com/MCmoderSD/YEPPDash',
    },
  },
  {
    id: 'two-addresses',
    topic: 'general',
    added: '2026-08-03',
    question: 'Why is the dashboard on a different address than the website?',
    answer: 'The public site lives on yeppbot.com and the dashboard on dash.yeppbot.com. Logging in moves you from one to the other.',
    details: [
      'Splitting them keeps the pages anyone can read — the landing page, this FAQ, the legal pages — apart from the ones holding your Twitch token, so the two have nothing to share by accident.',
    ],
  },

  // --- Management ---------------------------------------------------------------------------------

  {
    id: 'add-a-moderator',
    topic: 'moderators',
    added: '2026-09-07',
    question: 'How do I add or remove a moderator?',
    answer: 'Open Moderators, hit Add moderator and pick the account. Removing one is a button on their row.',
    details: [
      'The page lists everybody who currently holds the role in your channel, with the count in the header, so you can see at a glance who has it.',
      'The change goes through Twitch on your behalf, which is what the login is for. It takes effect in your channel immediately, whether or not the bot is in chat.',
    ],
  },
  {
    id: 'bot-needs-moderator',
    topic: 'moderators',
    added: '2026-09-07',
    question: 'Does YEPPBot itself need to be a moderator?',
    answer: 'Not to run, but without the role it is limited by your chat settings, and timeouts and auto-shoutouts do not work at all.',
    details: [
      'The Overview says which it is, and offers a Make moderator button when the bot does not have it.',
      'It is also the account that carries out the channel point timeout reward, so that module needs the role too.',
    ],
  },
  {
    id: 'vips-where',
    topic: 'vips',
    added: '2026-09-07',
    question: 'Where do I hand out VIP badges?',
    answer: 'Under VIPs, on the same screen the moderator list uses — the two are one page told apart by which entry you picked.',
    details: [
      'Adding and taking back a badge work exactly as they do for moderators, and the header counts how many your channel has.',
    ],
  },
  {
    id: 'vip-timeout-protection',
    topic: 'vips',
    added: '2026-09-07',
    question: 'Does a timeout take somebody\'s VIP badge away?',
    answer: 'No. A timeout only touches the lead moderator, moderator and editor roles. VIP, artist and business manager are left alone.',
    details: [
      'That holds however the timeout came about — from you, from a moderator, or from the channel point reward.',
    ],
  },
  {
    id: 'end-a-timeout',
    topic: 'timeouts',
    added: '2026-09-07',
    question: 'Can I end a timeout or a ban from here?',
    answer: 'Yes. Timeouts & Bans lists everybody currently timed out or banned and until when, and either can be lifted from the row.',
    details: [
      'The list is what Twitch currently holds for your channel, so somebody a moderator banned in chat shows up here too.',
    ],
  },
  {
    id: 'export-quotes',
    topic: 'quotes',
    added: '2026-09-07',
    question: 'Can I back up my quotes?',
    answer: 'Yes. Export writes the whole list to an Excel file, and Import reads one back in.',
    details: [
      'This is the one place in the dashboard with a real export, and it exists because this is beta software — a set of quotes that would hurt to lose is worth keeping a copy of.',
    ],
  },
  {
    id: 'import-replaces-quotes',
    topic: 'quotes',
    added: '2026-09-07',
    question: 'What does importing do to the quotes I already have?',
    answer: 'It replaces them. An import is not a merge: the list in the file becomes the list in your channel.',
    details: [
      'Export first if the current list matters, and you have the old one to go back to.',
    ],
  },
  {
    id: 'reorder-quotes',
    topic: 'quotes',
    added: '2026-09-07',
    question: 'Can I change what number a quote has?',
    answer: 'Yes. Each row has arrows that move a quote up or down, and the numbering follows the order.',
    details: [
      'The search box above the table takes either a word from the message or a quote number.',
    ],
  },
  {
    id: 'write-a-command',
    topic: 'commands',
    added: '2026-09-07',
    question: 'How do I add a custom command?',
    answer: 'Add command, then give it the word chat types, the answer it should give, and who is allowed to run it.',
    details: [
      'A command can carry aliases — other words that run the same thing — and a user level, which is the lowest rank allowed to use it.',
      'Saving reloads the running bot, so the command works in chat straight away rather than at the next restart.',
    ],
  },
  {
    id: 'switch-a-command-off',
    topic: 'commands',
    added: '2026-09-07',
    question: 'Can I switch a command off without deleting it?',
    answer: 'Yes. A command can be inactive, which leaves it in the list but stops chat from running it.',
    details: [
      'The header counts both, so "12 commands in your channel, 9 active" tells you three are switched off.',
    ],
  },
  {
    id: 'commands-still-buggy',
    topic: 'commands',
    added: '2026-09-07',
    question: 'Why is this module marked as buggy?',
    answer: 'Custom commands work, but this is the one live module with known rough edges, so it says so rather than pretending otherwise.',
    details: [
      'If you hit one of them, an issue on GitHub is the fastest way to get it looked at.',
    ],
    link: {
      label: 'Open an issue on GitHub',
      url: 'https://github.com/MCmoderSD/YEPPDash/issues',
    },
  },

  // --- Community ----------------------------------------------------------------------------------

  {
    id: 'follower-list',
    topic: 'follower',
    added: '2026-09-07',
    question: 'What is in the Follower list?',
    answer: 'Everybody who follows your channel, since when, and which roles they hold, with a search box over the top.',
    details: [
      'It is read from Twitch each time you open it, so it is as current as your channel is.',
    ],
  },
  {
    id: 'birthdays-come-from',
    topic: 'birthdays',
    added: '2026-09-07',
    question: 'How do birthdays get into this list?',
    answer: 'Your followers share them with YEPPBot themselves. Nothing is guessed, and nothing appears until somebody hands it over.',
    details: [
      'That is why the list is empty on a channel where nobody has done it yet — there is no source for a birthday other than the person whose it is.',
    ],
  },
  {
    id: 'set-my-own-birthday',
    topic: 'birthdays',
    added: '2026-09-07',
    question: 'Where do I set my own birthday?',
    answer: 'In the account menu at the top right of the dashboard, under Set birthday.',
    details: [
      'It sits with your account rather than in this list because it is yours — the list is about your community.',
    ],
  },
  {
    id: 'raid-history',
    topic: 'raids',
    added: '2026-09-07',
    question: 'How far back does the raid list go?',
    answer: 'Raids are recorded from the moment YEPPBot is in your channel: who raided, how many they brought, and when.',
    details: [
      'The header adds them up, so you can see both how many raids you have had and how many viewers arrived that way.',
      'Anything from before the bot joined is not there, because nothing was watching for it yet.',
    ],
  },
  {
    id: 'auto-shoutout',
    topic: 'raids',
    added: '2026-08-31',
    question: 'Does the bot shout out people who raid me?',
    answer: 'Yes, automatically, once the bot is a moderator in your channel.',
    details: [
      'Every raid is also listed in the dashboard with who came, how many they brought, and when — so you can still thank someone you missed live.',
    ],
  },

  // --- Entertainment ------------------------------------------------------------------------------

  {
    id: 'what-is-the-queue',
    topic: 'queue',
    added: '2026-08-31',
    question: 'What is the viewer queue for?',
    answer: 'A waiting list you work through in order, for anything where viewers take turns: games with you, reviews, requests.',
    details: [
      'The dashboard half is finished — you can see the queue, reorder it and work it down. Chat cannot join it yet, because the commands for that are not in the bot itself so far.',
    ],
  },
  {
    id: 'who-may-join-the-queue',
    topic: 'queue',
    added: '2026-09-07',
    question: 'Can I limit who joins the queue?',
    answer: 'Yes, to everyone, followers, subscribers or VIPs. It is one level, not a floor.',
    details: [
      'Somebody who does not hold exactly that role is turned away even if they hold a higher one. You and your moderators always get in.',
      'A queue that has never been opened starts closed, so it cannot quietly fill up before you are ready.',
    ],
  },
  {
    id: 'queue-who-does-what',
    topic: 'queue',
    added: '2026-09-07',
    question: 'What can chat do to the queue, and what only I can?',
    answer: 'Joining and leaving are chat\'s. Opening, closing, clearing, reordering and taking the person at the front off are yours.',
    details: [
      'Nobody is ever added from the dashboard, which is why the requirement above only has to be checked in one place.',
      'Chat and the dashboard work on the same list, so anything either side does shows up on the other within a second or two.',
    ],
  },
  {
    id: 'several-wheels',
    topic: 'wheel',
    added: '2026-09-07',
    question: 'Can I keep more than one wheel?',
    answer: 'Yes. Every wheel has its own entries, its own results and its own browser source, so you can set one up per segment and switch between them.',
    details: [
      'A browser source you added to OBS stays pointed at the wheel you made it for, so switching wheels here does not disturb a scene.',
    ],
  },
  {
    id: 'wheel-duplicate-names',
    topic: 'wheel',
    added: '2026-09-07',
    question: 'What happens if I add the same name twice?',
    answer: 'It becomes 2x rather than a second slice, which is how you give somebody better odds.',
    details: [
      'You can paste a whole list at once: every line becomes its own entry, and commas split the same way.',
    ],
  },
  {
    id: 'wheel-overlay',
    topic: 'wheel',
    added: '2026-09-07',
    question: 'Can my viewers watch the wheel spin?',
    answer: 'Yes. Each wheel has a browser source link for OBS that shows the same wheel and spins along when you spin here.',
    details: [
      'The link stays the same, so it goes into a scene once. Resize it freely — the wheel scales with the source and follows the list on this page.',
    ],
  },
  {
    id: 'timer-from-chat',
    topic: 'timer',
    added: '2026-09-07',
    question: 'Can the timer be driven from chat?',
    answer: 'Yes. The bot drives the same timer this page does, so anything here can be done from chat instead — and the other way round.',
    details: [
      'start and stop, add and remove, set and reset all exist as !timer commands. Only you and your moderators can use them; chat cannot touch the timer.',
      'Times can be written as seconds or as something friendlier: 300, 5m, 1h30m and 01:30:00 all work, here and in chat.',
    ],
  },
  {
    id: 'timer-overlay',
    topic: 'timer',
    added: '2026-09-07',
    question: 'How do I get the timer on stream?',
    answer: 'Add the browser source link to OBS. The countdown follows every change, whether it came from this page or from chat.',
    details: [
      'The link is yours and stays the same, and the timer scales with whatever size you give the source.',
      'Colours, size and an optional label are set on this page and reach the overlay on their own — there is nothing to copy into OBS.',
    ],
  },
  {
    id: 'timer-survives-a-reload',
    topic: 'timer',
    added: '2026-09-07',
    question: 'Does the timer keep running if I close the dashboard?',
    answer: 'Yes. What is stored is the moment it reaches zero, not a number being counted down, so nothing has to stay open for it to keep going.',
    details: [
      'The overlay, this page and the bot each work the display out from that one deadline, which is why they never drift apart.',
    ],
  },
  {
    id: 'bdsm-results',
    topic: 'bdsm',
    added: '2026-09-07',
    question: 'How does a BDSM test result get here?',
    answer: 'Somebody takes the test and shares the result with YEPPBot. This page then shows your own result and those your followers have shared.',
    details: [
      'Nothing is fetched on anybody\'s behalf: a result appears only because the person it belongs to handed it over.',
    ],
  },

  // --- Rewards ------------------------------------------------------------------------------------

  {
    id: 'channel-points-required',
    topic: 'timeout-reward',
    added: '2026-09-07',
    question: 'Why can I not open the reward modules?',
    answer: 'Both are built on channel points, and Twitch only gives those to Affiliates and Partners.',
    details: [
      'Until your channel is one of the two and has channel points switched on, there is no reward for YEPPDash to create or listen to.',
      'If you have only just been accepted, reload the page — your status is read once per visit.',
    ],
  },
  {
    id: 'timeout-reward',
    topic: 'timeout-reward',
    added: '2026-08-31',
    question: 'Can viewers spend channel points to time someone out?',
    answer: 'Yes, once you set the reward up. Viewers redeem it, type a name, and that viewer is timed out for as long as you chose.',
    details: [
      'You set the price, the length, and who cannot be bought — editors, moderators, VIPs, subscribers by tier, followers. A protected name, a name nobody has, or your own gets the points refunded automatically.',
      'A timeout takes the moderator role with it and hands it back when it runs out. Lead moderator and editor cannot be given back through Twitch\'s API, so leave those protected unless you mean it.',
    ],
  },
  {
    id: 'timeout-reward-limits',
    topic: 'timeout-reward',
    added: '2026-09-07',
    question: 'Can I stop one viewer redeeming it over and over?',
    answer: 'Yes. The reward carries a cooldown, a cap per stream and a cap per viewer per stream, and any of the three can be left off.',
    details: [
      'They are Twitch\'s own redemption limits rather than something checked afterwards, so a redemption that would break one is never made in the first place.',
    ],
  },
  {
    id: 'run-a-giveaway',
    topic: 'giveaway',
    added: '2026-09-02',
    question: 'Can I run a giveaway with channel points?',
    answer: 'Yes. You set up a reward viewers redeem to enter, close entries when you are ready, and spin a wheel to draw the winner.',
    details: [
      'Roles decide both halves of it. Each of follower, subscriber, Tier 2, Tier 3, VIP and moderator can be required, excluded, or ignored, and each carries a multiplier that makes an entry count for more or less. A redemption that does not qualify is refunded automatically.',
      'The wheel is weighted, so a slice is as big as that chance really is, and it runs on an OBS browser source your viewers can watch live. The same person can be drawn again unless you take them off the wheel first.',
      'The reward stays switched off on Twitch until you open registration, and is switched off again when you close it — so nobody can enter while you are drawing, and nobody can enter a giveaway that has not started.',
    ],
  },
  {
    id: 'giveaway-change-the-rules',
    topic: 'giveaway',
    added: '2026-09-07',
    question: 'Can I change the rules while a giveaway is running?',
    answer: 'Not while registration is open. Close it first — the rules cannot move while people are entering under them.',
    details: [
      'Once it is closed, changing a multiplier reweighs everybody who already entered, using the roles they held at the time. Nobody is taken off the wheel by it.',
    ],
  },
  {
    id: 'giveaway-reset',
    topic: 'giveaway',
    added: '2026-09-07',
    question: 'What does resetting a giveaway do?',
    answer: 'It goes back to draft and clears every entry and every winner. There is no undo, and it does not ask twice.',
    details: [
      'Use close rather than reset if you only want to stop new entries — closing keeps everybody who has already entered.',
    ],
  },
];

function haystack(entry: FaqEntry): string {
  return [entry.question, entry.answer, ...entry.details, entry.link?.label ?? '']
    .join(' ')
    .toLowerCase();
}

function matches(entry: FaqEntry, search: string): boolean {
  const terms: string[] = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const text: string = haystack(entry);
  return terms.every((term: string): boolean => text.includes(term));
}

export function filterFaq(entries: readonly FaqEntry[], query: FaqQuery): readonly FaqEntry[] {
  return entries.filter((entry: FaqEntry): boolean =>
    (query.topic === null || entry.topic === query.topic) && matches(entry, query.search));
}

export function groupFaq(entries: readonly FaqEntry[]): readonly FaqSection[] {
  const order: FaqTopicMeta[] = [
    GENERAL_TOPIC,
    ...FAQ_TOPIC_GROUPS.flatMap((group: FaqTopicGroup): FaqTopicMeta[] => [...group.topics]),
  ];

  return order
    .map((topic: FaqTopicMeta): FaqSection => ({
      topic,
      entries: entries.filter((entry: FaqEntry): boolean => entry.topic === topic.id),
    }))
    .filter((section: FaqSection): boolean => section.entries.length > 0);
}

export function faqCounts(entries: readonly FaqEntry[]): ReadonlyMap<FaqTopic | 'all', number> {
  const counts = new Map<FaqTopic | 'all', number>([['all', entries.length]]);

  for (const entry of entries) {
    counts.set(entry.topic, (counts.get(entry.topic) ?? 0) + 1);
  }

  return counts;
}