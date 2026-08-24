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
      answer: 'A Twitch chat bot that answers commands, manages your VIPs and moderators and keeps your community entertained while you stream.',
      details: [
        'It runs as a single hosted instance, so there is nothing for you to install or keep online. You invite it into your channel and it is there the next time you go live.',
        'YEPPBot has been around as a beta project for a long time. What is new is this dashboard, which is how you configure it without memorising chat commands.',
      ],
    },
    {
      question: 'What is YEPPDash, and how is it different from the bot?',
      answer: 'YEPPDash is the web dashboard you are on right now. It is the control panel for YEPPBot, not the bot itself.',
      details: [
        'The bot has no console and no settings screen of its own. Everything it knows lives in a database, and until now the only way to change any of it was through chat commands.',
        'The dashboard talks to its own backend, which talks to the bot. You never talk to the bot directly, which is exactly the point: the bot keeps a very small set of inputs and stays hard to attack.',
      ],
    },
    {
      question: 'How do I get the bot into my channel?',
      answer: 'Log in with Twitch, open the dashboard and hit join. The bot is in your chat a moment later.',
      details: [
        'You can send it away again from the same place. Nothing is deleted when you do, so your commands, quotes and birthdays are still there if you invite it back.',
        'The bot needs to be a moderator in your channel for some features, timeouts and shoutouts in particular. It works without that, it just does less.',
      ],
    },
    {
      question: 'Does it cost anything?',
      answer: 'No. YEPPBot and YEPPDash are free, with no paid tier, no ads and no feature held back behind a subscription.',
      details: [
        'This is a hobby project, not a business. There is no plan to monetise it, and no plan to make the interesting parts cost money later.',
        'That also means there is no support contract behind it. See the question about uptime below.',
      ],
    },
    {
      question: 'What happens when I log in with Twitch?',
      answer: 'You are sent to Twitch, you approve the access there, and Twitch sends you back. YEPPDash never sees your password.',
      details: [
        'There is no YEPPDash account and no password to pick. Your Twitch identity is the only login, and the access token that comes back is stored encrypted.',
        'The token is what lets the dashboard read your followers and change your moderators and VIPs on your behalf. Revoking access in your Twitch settings cuts that off immediately.',
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
        'Dedicated machines rather than shared hosting, with a German provider held to strict data protection rules. The database, the backend and this site all sit there.',
        'Nothing is reachable directly. Every request goes through a reverse proxy first, and in front of that sits Cloudflare\'s proxy as a protective layer, absorbing attack traffic and keeping the real server addresses out of sight.',
      ],
    },
    {
      question: 'Which features actually work right now?',
      answer: 'Bot join and leave, moderator and VIP management, quotes, follower birthdays, BDSM test results, the two OBS overlays and Spotify song requests are all live. Custom commands work but are still buggy, and auto-shoutouts for raids do not exist yet.',
      details: [
        'The landing page carries a badge next to each feature saying how far along it is. Anything marked "Coming soon" is genuinely not built yet rather than hidden somewhere.',
        'Features will keep being added and some existing ones will change shape as the dashboard settles down.',
      ],
    },
    {
      question: 'How do Spotify song requests work, and what do I need for them?',
      answer: 'Connect your Spotify account once on the Spotify page, and chat can request tracks with !spotify. It needs Spotify Premium — that is Spotify\'s rule for controlling playback, not ours.',
      details: [
        'Connecting is optional and asks for playback control only: what is playing, and adding to, skipping, starting or stopping it. It cannot see your library, your playlists or your listening history, and you can unlink it from the dashboard or from Spotify at any time.',
        'You decide the rules: whether chat may request at all, how long between one viewer\'s requests, how long a track may be, whether it only works while you are live, and which tracks and artists are blocked outright.',
        'Two things worth knowing before you point it at a live stream. Spotify\'s developer policy does not actually bless playing its music over a broadcast, even though plenty of people do it. And Twitch mutes or removes VODs and clips that contain copyrighted music, whatever put it there.',
        'Tracks cannot be taken back out of the queue once they are in it. Spotify simply offers no way to do that, so neither does this.',
        'One catch, and it comes from Spotify rather than from us: an app in development mode may only be authorized by five accounts besides the one that owns it, and the route past that is effectively closed to anyone below a quarter of a million monthly users. So this feature is limited to a handful of channels, and each one has to be added by hand. Ask if you want a slot.',
      ],
    },
    {
      question: 'How stable is this? Can I lose my data?',
      answer: 'Both the bot and the dashboard run stably in practice, but this is early beta software with no uptime guarantee and no promise that data cannot be lost.',
      details: [
        'The dashboard only launched at the end of July 2026. The design will change significantly, and bugs almost certainly exist in corners that have not been walked through yet.',
        'If a set of quotes or commands would genuinely hurt to lose, export it. The quote list has an Excel export for exactly that reason.',
      ],
    },
    {
      question: 'I found a bug, or I want a feature. What do I do?',
      answer: 'Open an issue on GitHub. Bug reports and feature requests both go in the same place, and both are read.',
      details: [
        'For a bug, the useful things to include are what you clicked, what you expected and what happened instead. A screenshot beats a description.',
        'Pull requests are welcome too, if you would rather build the thing than wait for it.',
      ],
      link: {
        label: 'Open an issue on GitHub',
        url: 'https://github.com/MCmoderSD/YEPPDash/issues',
      },
    },
    {
      question: 'Who builds and runs this?',
      answer: 'One person: Seraphin Berger, better known as MCmoderSD. The bot, this dashboard and the backend between them are all solo-developed.',
      details: [
        'That is worth knowing because it sets expectations. There is nobody on call, no support rota, and answers arrive whenever there is time for them. It is a hobby project rather than a company.',
        'It also means there is no ticket queue to disappear into: a bug report or a feature request lands directly with the person who wrote the code.',
      ],
      link: {
        label: 'Imprint and contact details',
        url: `${environment.marketingBaseUrl}/imprint`,
      },
    },
    {
      question: 'Is it open source?',
      answer: 'Yes. The bot and the dashboard are both public on GitHub under the BSD 3-Clause licence, and they will stay that way.',
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
        'Splitting them keeps the pages anyone can read separate from the ones that need your Twitch token, so the two have nothing to share by accident.',
        'The landing page, this FAQ and the legal pages are all on the public side. Everything behind the login is on the dashboard side.',
      ],
    },
  ];
}