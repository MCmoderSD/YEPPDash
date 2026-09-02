import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FaqEntry, FaqEntryComponent } from "../../components/faq-entry-component/faq-entry.component";
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-faq-page',
  templateUrl: './faq-page.component.html',
  styleUrl: './faq-page.component.scss',
  imports: [MatIconModule, FaqEntryComponent],
})
export class FaqPageComponent {

  protected readonly entries: readonly FaqEntry[] = [
    {
      question: 'What is YEPPBot?',
      answer: 'A Twitch chatbot that answers commands, manages your VIPs and moderators, and keeps your community entertained while you stream.',
      details: [
        'It runs as a single hosted instance, so there is nothing for you to install or keep online. You invite it into your channel, and it is there the next time you go live.',
        'YEPPBot has been around as a beta project for a long time. What is new is this dashboard, which is how you configure it without memorizing chat commands.',
      ],
    },
    {
      question: 'What is YEPPDash, and how is it different from the bot?',
      answer: 'YEPPDash is the web dashboard you are on right now. It is the control panel for YEPPBot, not the bot itself.',
      details: [
        'The bot has no console and no settings screen of its own. Everything it knows lives in a database, and until now the only way to change any of it was through chat commands.',
        'The dashboard talks to its own backend, which talks to the bot. You never talk to the bot directly, which is exactly the point: the bot keeps a tiny set of inputs and stays hard to attack.',
      ],
    },
    {
      question: 'How do I get the bot into my channel?',
      answer: 'Log in with Twitch, open the dashboard, and hit join. The bot is in your chat a moment later.',
      details: [
        'You can send it away again from the same place. Nothing is deleted when you do, so your commands, quotes, and birthdays are still there if you invite it back.',
        'The bot needs to be a moderator in your channel for some features, timeouts, and shoutouts in particular. It works without that, it just does less.',
      ],
    },
    {
      question: 'Does it cost anything?',
      answer: 'No. YEPPBot and YEPPDash are free, with no paid tier, no ads, and no feature held back behind a subscription.',
      details: [
        'This is a hobby project, not a business. There is no plan to monetize it, and none to put the interesting parts behind a price later.',
      ],
    },
    {
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
      question: 'Where is all of this hosted?',
      answer: 'On dedicated Hetzner servers inside the EU, so EU data protection law and the GDPR apply to the whole thing.',
      details: [
        'Dedicated machines rather than shared hosting, with the database, the backend and this site all in one place.',
        'Nothing is reachable directly: every request passes a reverse proxy, with Cloudflare in front of it keeping the real addresses out of sight.',
      ],
    },
    {
      question: 'Which features actually work right now?',
      answer: 'Bot join and leave, moderator and VIP management, quotes, follower birthdays, BDSM test results, auto-shoutouts for raids, the channel point timeout reward and channel point giveaways are all live. Custom commands work but are still buggy.',
      details: [
        'The landing page carries a badge next to each feature saying how far along it is. Anything marked "Coming soon" is genuinely not built yet rather than hidden somewhere.',
      ],
    },
    {
      question: 'Can viewers spend channel points to time someone out?',
      answer: 'Yes, once you set the reward up. Viewers redeem it, type a name, and that viewer is timed out for as long as you chose.',
      details: [
        'You set the price, the length, and who cannot be bought — editors, moderators, VIPs, subscribers by tier, followers. A protected name, a name nobody has, or your own gets the points refunded automatically.',
        'A timeout takes the moderator role with it and hands it back when it runs out. Lead moderator and editor cannot be given back through Twitch\'s API, so leave those protected unless you mean it.',
      ],
    },
    {
      question: 'Can I run a giveaway with channel points?',
      answer: 'Yes. You set up a reward viewers redeem to enter, close entries when you are ready, and spin a wheel to draw the winner.',
      details: [
        'Roles decide both halves of it. Each of follower, subscriber, Tier 2, Tier 3, VIP and moderator can be required, excluded, or ignored, and each carries a multiplier that makes an entry count for more or less. A redemption that does not qualify is refunded automatically.',
        'The wheel is weighted, so a slice is as big as that chance really is, and it runs on an OBS browser source your viewers can watch live. The same person can be drawn again unless you take them off the wheel first.',
        'The reward stays switched off on Twitch until you open registration, and is switched off again when you close it — so nobody can enter while you are drawing, and nobody can enter a giveaway that has not started.',
      ],
    },
    {
      question: 'Does the bot shout out people who raid me?',
      answer: 'Yes, automatically, once the bot is a moderator in your channel.',
      details: [
        'Every raid is also listed in the dashboard with who came, how many they brought, and when — so you can still thank someone you missed live.',
      ],
    },
    {
      question: 'What is the viewer queue for?',
      answer: 'A waiting list you work through in order, for anything where viewers take turns: games with you, reviews, requests.',
      details: [
        'The dashboard half is finished — you can see the queue, reorder it and work it down. Chat cannot join it yet, because the commands for that are not in the bot itself so far.',
      ],
    },
    {
      question: 'How stable is this? Can I lose my data?',
      answer: 'Both the bot and the dashboard run stably in practice, but this is early beta software with no uptime guarantee and no promise that data cannot be lost.',
      details: [
        'The dashboard only launched at the end of July 2026. The design will change significantly, and bugs almost certainly exist in corners that have not been walked through yet.',
        'If a set of quotes or commands genuinely hurts to lose, export it. The quote list has an Excel export for exactly that reason.',
      ],
    },
    {
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
      question: 'Why is the dashboard on a different address than the website?',
      answer: 'The public site lives on yeppbot.com and the dashboard on dash.yeppbot.com. Logging in moves you from one to the other.',
      details: [
        'Splitting them keeps the pages anyone can read — the landing page, this FAQ, the legal pages — apart from the ones holding your Twitch token, so the two have nothing to share by accident.',
      ],
    },
  ];
}