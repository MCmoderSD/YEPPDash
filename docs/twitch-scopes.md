# Twitch Scopes

Every scope Twitch documents at [https://dev.twitch.tv/docs/authentication/scopes/](https://dev.twitch.tv/docs/authentication/scopes/), transcribed so the list can be diffed
against what this app actually asks for without opening a browser. Copied verbatim, including the
endpoint links each scope unlocks — the wording is Twitch's, not ours, so it can be re-fetched and
compared line by line when they change something.

81 scopes in total: 78 twitch api and eventsub scopes, 2 irc chat scopes, 1 pubsub-specific chat scopes.

The two sets in [`TwitchScopes.cs`](../backend/YEPPDash.Api/Twitch/TwitchScopes.cs) are drawn from
this list. **Dev** asks for all 81. **Prod** asks for 18, which is not the same as 18 the dashboard
calls: one login serves both halves of the project, so the set is the union of what the dashboard
calls itself and what YEPPBot needs on the same authorisation.

| Needed by | # | Scopes |
|---|---|---|
| Both | 7 | `channel:read:editors`, `channel:manage:moderators`, `channel:read:subscriptions`, `channel:manage:vips`, `moderator:read:chatters`, `moderator:read:followers`, `user:read:email` |
| YEPPBot only | 6 | `channel:edit:commercial`, `channel:manage:raids`, `channel:read:vips`, `moderation:read`, `moderator:manage:chat_messages`, `moderator:manage:shoutouts` |
| Dashboard only | 5 | `channel:manage:broadcast`, `channel:manage:redemptions`, `moderator:manage:banned_users`, `user:read:blocked_users`, `user:manage:blocked_users` |

The six in the middle row are why the dashboard never calls an endpoint for some of what it asks
for. They are the bot's, and the lines carry a `// YEPPBot` marker so that stays visible; taking
one out removes a bot feature rather than trimming an unused permission.

A scope is granted when the user authorises, so adding one to either set means every user of that
environment has to log in again before the new permission exists on their token.

## Twitch API and EventSub scopes

| Scope Name | Type of Access and Associated Endpoints |
|---|---|
| `analytics:read:extensions` | View analytics data for the Twitch Extensions owned by the authenticated account.<br><br>**API**<br>[Get Extension Analytics](https://dev.twitch.tv/docs/api/reference#get-extension-analytics) |
| `analytics:read:games` | View analytics data for the games owned by the authenticated account.<br><br>**API**<br>[Get Game Analytics](https://dev.twitch.tv/docs/api/reference#get-game-analytics) |
| `bits:read` | View Bits-related products and redemptions for a channel.<br><br>**API**<br>[Get Bits Leaderboard](https://dev.twitch.tv/docs/api/reference#get-bits-leaderboard)<br>[Get Custom Power-up](https://dev.twitch.tv/docs/api/reference/#get-custom-power-up)<br><br>**EventSub**<br>[Channel Bits Use](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelbitsuse)<br>[Channel Cheer](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelcheer)<br>[Channel Custom Power-ups Redemption Add](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelcustom_power_up_redemptionadd) |
| `channel:bot` | Joins your channel’s chatroom as a bot user, and perform chat-related actions as that user.<br><br>**API**<br>[Send Chat Message](https://dev.twitch.tv/docs/api/reference/#send-chat-message)<br><br>**EventSub**<br>[Channel Chat Clear](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatclear)<br>[Channel Chat Clear User Messages](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatclear_user_messages)<br>[Channel Chat Message](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage)<br>[Channel Chat Message Delete](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage_delete)<br>[Channel Chat Notification](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatnotification)<br>[Channel Chat Settings Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchat_settingsupdate) |
| `channel:manage:ads` | Manage ads schedule on a channel.<br><br>**API**<br>[Snooze Next Ad](https://dev.twitch.tv/docs/api/reference#snooze-next-ad) |
| `channel:read:ads` | Read the ads schedule and details on your channel.<br><br>**API**<br>[Get Ad Schedule](https://dev.twitch.tv/docs/api/reference#get-ad-schedule)<br><br>**EventSub**<br>[Channel Ad Break Begin](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelad_breakbegin) |
| `channel:manage:broadcast` | Manage a channel’s broadcast configuration, including updating channel configuration and managing stream markers and stream tags.<br><br>**API**<br>[Modify Channel Information](https://dev.twitch.tv/docs/api/reference#modify-channel-information)<br>[Create Stream Marker](https://dev.twitch.tv/docs/api/reference#create-stream-marker)<br>[Replace Stream Tags](https://dev.twitch.tv/docs/api/reference#replace-stream-tags) |
| `channel:read:charity` | Read charity campaign details and user donations on your channel.<br><br>**API**<br>[Get Charity Campaign](https://dev.twitch.tv/docs/api/reference#get-charity-campaign)<br>[Get Charity Campaign Donations](https://dev.twitch.tv/docs/api/reference/#get-charity-campaign-donations)<br><br>**EventSub**<br>[Charity Donation](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelcharity_campaigndonate)<br>[Charity Campaign Start](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelcharity_campaignstart)<br>[Charity Campaign Progress](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelcharity_campaignprogress)<br>[Charity Campaign Stop](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelcharity_campaignstop) |
| `channel:manage:clips` | Manage Clips for a channel.<br><br>**API**<br>[Create Clip From VOD](https://dev.twitch.tv/docs/api/reference#create-clip-from-vod)<br>[Get Clips Download](https://dev.twitch.tv/docs/api/reference#get-clips-download) |
| `channel:edit:commercial` | Run commercials on a channel.<br><br>**API**<br>[Start Commercial](https://dev.twitch.tv/docs/api/reference#start-commercial) |
| `channel:read:editors` | View a list of users with the editor role for a channel.<br><br>**API**<br>[Get Channel Editors](https://dev.twitch.tv/docs/api/reference#get-channel-editors) |
| `channel:manage:extensions` | Manage a channel’s Extension configuration, including activating Extensions.<br><br>**API**<br>[Get User Active Extensions](https://dev.twitch.tv/docs/api/reference#get-user-active-extensions)<br>[Update User Extensions](https://dev.twitch.tv/docs/api/reference#update-user-extensions) |
| `channel:read:goals` | View Creator Goals for a channel.<br><br>**API**<br>[Get Creator Goals](https://dev.twitch.tv/docs/api/reference#get-creator-goals)<br><br>**EventSub**<br>[Goal Begin](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelgoalbegin)<br>[Goal Progress](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelgoalprogress)<br>[Goal End](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelgoalend) |
| `channel:read:guest_star` | Read Guest Star details for your channel.<br><br>**API**<br>[Get Channel Guest Star Settings](https://dev.twitch.tv/docs/api/reference#get-channel-guest-star-settings)<br>[Get Guest Star Session](https://dev.twitch.tv/docs/api/reference#get-guest-star-session)<br>[Get Guest Star Invites](https://dev.twitch.tv/docs/api/reference#get-guest-star-invites)<br><br>**EventSub**<br>[Channel Guest Star Session Begin](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelguest_star_sessionbegin)<br>[Channel Guest Star Session End](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelguest_star_sessionend)<br>[Channel Guest Star Guest Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelguest_star_guestupdate)<br>[Channel Guest Star Settings Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelguest_star_settingsupdate) |
| `channel:manage:guest_star` | Manage Guest Star for your channel.<br><br>**API**<br>[Update Channel Guest Star Settings](https://dev.twitch.tv/docs/api/reference#update-channel-guest-star-settings)<br>[Create Guest Star Session](https://dev.twitch.tv/docs/api/reference#create-guest-star-session)<br>[End Guest Star Session](https://dev.twitch.tv/docs/api/reference#end-guest-star-session)<br>[Send Guest Star Invite](https://dev.twitch.tv/docs/api/reference#send-guest-star-invite)<br>[Delete Guest Star Invite](https://dev.twitch.tv/docs/api/reference#delete-guest-star-invite)<br>[Assign Guest Star Slot](https://dev.twitch.tv/docs/api/reference#assign-guest-star-slot)<br>[Update Guest Star Slot](https://dev.twitch.tv/docs/api/reference#update-guest-star-slot)<br>[Delete Guest Star Slot](https://dev.twitch.tv/docs/api/reference#delete-guest-star-slot)<br>[Update Guest Star Slot Settings](https://dev.twitch.tv/docs/api/reference#update-guest-star-slot-settings)<br><br>**EventSub**<br>[Channel Guest Star Session Begin](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelguest_star_sessionbegin)<br>[Channel Guest Star Session End](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelguest_star_sessionend)<br>[Channel Guest Star Guest Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelguest_star_guestupdate)<br>[Channel Guest Star Settings Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelguest_star_settingsupdate) |
| `channel:read:hype_train` | View Hype Train information for a channel.<br><br>**API**<br>[Get Hype Train Status](https://dev.twitch.tv/docs/api/reference#get-hype-train-status)<br><br>**EventSub**<br>[Hype Train Begin](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelhype_trainbegin)<br>[Hype Train Progress](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelhype_trainprogress)<br>[Hype Train End](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelhype_trainend) |
| `channel:manage:moderators` | Add or remove the moderator role from users in your channel.<br><br>**API**<br>[Add Channel Moderator](https://dev.twitch.tv/docs/api/reference#add-channel-moderator)<br>[Remove Channel Moderator](https://dev.twitch.tv/docs/api/reference#remove-channel-moderator)<br>[Get Moderators](https://dev.twitch.tv/docs/api/reference/#get-moderators) |
| `channel:read:polls` | View a channel’s polls.<br><br>**API**<br>[Get Polls](https://dev.twitch.tv/docs/api/reference#get-polls)<br><br>**EventSub**<br>[Channel Poll Begin](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelpollbegin)<br>[Channel Poll Progress](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelpollprogress)<br>[Channel Poll End](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelpollend) |
| `channel:manage:polls` | Manage a channel’s polls.<br><br>**API**<br>[Get Polls](https://dev.twitch.tv/docs/api/reference#get-polls)<br>[Create Poll](https://dev.twitch.tv/docs/api/reference#create-poll)<br>[End Poll](https://dev.twitch.tv/docs/api/reference#end-poll)<br><br>**EventSub**<br>[Channel Poll Begin](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelpollbegin)<br>[Channel Poll Progress](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelpollprogress)<br>[Channel Poll End](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelpollend) |
| `channel:read:predictions` | View a channel’s Channel Points Predictions.<br><br>**API**<br>[Get Channel Points Predictions](https://dev.twitch.tv/docs/api/reference#get-predictions)<br><br>**EventSub**<br>[Channel Prediction Begin](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelpredictionbegin)<br>[Channel Prediction Progress](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelpredictionprogress)<br>[Channel Prediction Lock](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelpredictionlock)<br>[Channel Prediction End](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelpredictionend) |
| `channel:manage:predictions` | Manage of channel’s Channel Points Predictions<br><br>**API**<br>[Get Channel Points Predictions](https://dev.twitch.tv/docs/api/reference#get-predictions)<br>[Create Channel Points Prediction](https://dev.twitch.tv/docs/api/reference#create-prediction)<br>[End Channel Points Prediction](https://dev.twitch.tv/docs/api/reference#end-prediction)<br><br>**EventSub**<br>[Channel Prediction Begin](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelpredictionbegin)<br>[Channel Prediction Progress](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelpredictionprogress)<br>[Channel Prediction Lock](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelpredictionlock)<br>[Channel Prediction End](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelpredictionend) |
| `channel:manage:raids` | Manage a channel raiding another channel.<br><br>**API**<br>[Start a raid](https://dev.twitch.tv/docs/api/reference#start-a-raid)<br>[Cancel a raid](https://dev.twitch.tv/docs/api/reference#cancel-a-raid) |
| `channel:read:redemptions` | View Channel Points custom rewards and their redemptions on a channel.<br><br>**API**<br>[Get Custom Reward](https://dev.twitch.tv/docs/api/reference#get-custom-reward)<br>[Get Custom Reward Redemption](https://dev.twitch.tv/docs/api/reference#get-custom-reward-redemption)<br><br>**EventSub**<br>[Channel Points Automatic Reward Redemption](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchannel_points_automatic_reward_redemptionadd)<br>[Channel Points Automatic Reward Redemption v2](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchannel_points_automatic_reward_redemptionadd-v2)<br>[Channel Points Custom Reward Add](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchannel_points_custom_rewardadd)<br>[Channel Points Custom Reward Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchannel_points_custom_rewardupdate)<br>[Channel Points Custom Reward Remove](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchannel_points_custom_rewardremove)<br>[Channel Points Custom Reward Redemption Add](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchannel_points_custom_reward_redemptionadd)<br>[Channel Points Custom Reward Redemption Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchannel_points_custom_reward_redemptionupdate) |
| `channel:manage:redemptions` | Manage Channel Points custom rewards and their redemptions on a channel.<br><br>**API**<br>[Get Custom Reward](https://dev.twitch.tv/docs/api/reference#get-custom-reward)<br>[Get Custom Reward Redemption](https://dev.twitch.tv/docs/api/reference#get-custom-reward-redemption)<br>[Create Custom Rewards](https://dev.twitch.tv/docs/api/reference#create-custom-rewards)<br>[Delete Custom Reward](https://dev.twitch.tv/docs/api/reference#delete-custom-reward)<br>[Update Custom Reward](https://dev.twitch.tv/docs/api/reference#update-custom-reward)<br>[Update Redemption Status](https://dev.twitch.tv/docs/api/reference#update-redemption-status)<br><br>**EventSub**<br>[Channel Points Automatic Reward Redemption](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchannel_points_automatic_reward_redemptionadd)<br>[Channel Points Custom Reward Add](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchannel_points_custom_rewardadd)<br>[Channel Points Custom Reward Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchannel_points_custom_rewardupdate)<br>[Channel Points Custom Reward Remove](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchannel_points_custom_rewardremove)<br>[Channel Points Custom Reward Redemption Add](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchannel_points_custom_reward_redemptionadd)<br>[Channel Points Custom Reward Redemption Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchannel_points_custom_reward_redemptionupdate) |
| `channel:manage:schedule` | Manage a channel’s stream schedule.<br><br>**API**<br>[Update Channel Stream Schedule](https://dev.twitch.tv/docs/api/reference#update-channel-stream-schedule)<br>[Create Channel Stream Schedule Segment](https://dev.twitch.tv/docs/api/reference#create-channel-stream-schedule-segment)<br>[Update Channel Stream Schedule Segment](https://dev.twitch.tv/docs/api/reference#update-channel-stream-schedule-segment)<br>[Delete Channel Stream Schedule Segment](https://dev.twitch.tv/docs/api/reference#delete-channel-stream-schedule-segment) |
| `channel:read:stream_key` | View an authorized user’s stream key.<br><br>**API**<br>[Get Stream Key](https://dev.twitch.tv/docs/api/reference#get-stream-key) |
| `channel:read:subscriptions` | View a list of all subscribers to a channel and check if a user is subscribed to a channel.<br><br>**API**<br>[Get Broadcaster Subscriptions](https://dev.twitch.tv/docs/api/reference#get-broadcaster-subscriptions)<br><br>**EventSub**<br>[Channel Subscribe](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelsubscribe)<br>[Channel Subscription End](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelsubscriptionend)<br>[Channel Subscription Gift](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelsubscriptiongift)<br>[Channel Subscription Message](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelsubscriptionmessage) |
| `channel:manage:videos` | Manage a channel’s videos, including deleting videos.<br><br>**API**<br>[Delete Videos](https://dev.twitch.tv/docs/api/reference#delete-videos) |
| `channel:read:vips` | Read the list of VIPs in your channel.<br><br>**API**<br>[Get VIPs](https://dev.twitch.tv/docs/api/reference#get-vips)<br><br>**EventSub**<br>[Channel VIP Add](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelvipadd)<br>[Channel VIP Remove](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelvipremove) |
| `channel:manage:vips` | Add or remove the VIP role from users in your channel.<br><br>**API**<br>[Get VIPs](https://dev.twitch.tv/docs/api/reference#get-vips)<br>[Add Channel VIP](https://dev.twitch.tv/docs/api/reference#add-channel-vip)<br>[Remove Channel VIP](https://dev.twitch.tv/docs/api/reference#remove-channel-vip)<br><br>**EventSub**<br>[Channel VIP Add](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelvipadd)<br>[Channel VIP Remove](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelvipremove) |
| `channel:moderate` | Perform moderation actions in a channel.<br><br>**EventSub**<br>[Channel Ban](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelban)<br>[Channel Unban](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelunban) |
| `clips:edit` | Manage Clips for a channel.<br><br>**API**<br>[Create Clip](https://dev.twitch.tv/docs/api/reference#create-clip) |
| `editor:manage:clips` | Manage Clips as an editor.<br><br>**API**<br>[Create Clip From VOD](https://dev.twitch.tv/docs/api/reference#create-clip-from-vod)<br>[Get Clips Download](https://dev.twitch.tv/docs/api/reference#get-clips-download) |
| `moderation:read` | View a channel’s moderation data including Moderators, Bans, Timeouts, and Automod settings.<br><br>**API**<br>[Check AutoMod Status](https://dev.twitch.tv/docs/api/reference#check-automod-status)<br>[Get Banned Users](https://dev.twitch.tv/docs/api/reference#get-banned-users)<br>[Get Moderators](https://dev.twitch.tv/docs/api/reference#get-moderators)<br><br>**EventSub**<br>[Channel Moderator Add](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderatoradd)<br>[Channel Moderator Remove](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderatorremove) |
| `moderator:manage:announcements` | Send announcements in channels where you have the moderator role.<br><br>**API**<br>[Send Chat Announcement](https://dev.twitch.tv/docs/api/reference#send-chat-announcement) |
| `moderator:manage:automod` | Manage messages held for review by AutoMod in channels where you are a moderator.<br><br>**API**<br>[Manage Held AutoMod Messages](https://dev.twitch.tv/docs/api/reference#manage-held-automod-messages)<br><br>**EventSub**<br>[AutoMod Message Hold](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#automodmessagehold)<br>[AutoMod Message Hold v2](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#automodmessagehold-v2)<br>[AutoMod Message Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#automodmessageupdate)<br>[AutoMod Message Update v2](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#automodmessageupdate-v2)<br>[AutoMod Terms Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#automodtermsupdate) |
| `moderator:read:automod_settings` | View a broadcaster’s AutoMod settings.<br><br>**API**<br>[Get AutoMod Settings](https://dev.twitch.tv/docs/api/reference#get-automod-settings)<br><br>**EventSub**<br>[AutoMod Settings Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#automodsettingsupdate) |
| `moderator:manage:automod_settings` | Manage a broadcaster’s AutoMod settings.<br><br>**API**<br>[Update AutoMod Settings](https://dev.twitch.tv/docs/api/reference#update-automod-settings) |
| `moderator:read:banned_users` | Read the list of bans or unbans in channels where you have the moderator role.<br><br>**EventSub**<br>[Channel Moderate](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate)<br>[Channel Moderate v2](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate-v2) |
| `moderator:manage:banned_users` | Ban and unban users.<br><br>**API**<br>[Get Banned Users](https://dev.twitch.tv/docs/api/reference/#get-banned-users)<br>[Ban User](https://dev.twitch.tv/docs/api/reference#ban-user)<br>[Unban User](https://dev.twitch.tv/docs/api/reference#unban-user)<br><br>**EventSub**<br>[Channel Moderate](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate)<br>[Channel Moderate v2](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate-v2) |
| `moderator:read:blocked_terms` | View a broadcaster’s list of blocked terms.<br><br>**API**<br>[Get Blocked Terms](https://dev.twitch.tv/docs/api/reference#get-blocked-terms)<br><br>**EventSub**<br>[Channel Moderate](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate) |
| `moderator:manage:blocked_terms` | Manage a broadcaster’s list of blocked terms.<br><br>**API**<br>[Get Blocked Terms](https://dev.twitch.tv/docs/api/reference#get-blocked-terms)<br>[Add Blocked Term](https://dev.twitch.tv/docs/api/reference#add-blocked-term)<br>[Remove Blocked Term](https://dev.twitch.tv/docs/api/reference#remove-blocked-term)<br><br>**EventSub**<br>[Channel Moderate](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate) |
| `moderator:read:chat_messages` | Read deleted chat messages in channels where you have the moderator role and get pinned chat messages.<br><br>**API**<br>[Get Pinned Chat Message](https://dev.twitch.tv/docs/api/reference#get-pinned-chat-message)<br><br>**EventSub**<br>[Channel Moderate](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate) |
| `moderator:manage:chat_messages` | Delete chat messages in channels where you have the moderator role and manage pinned chat messages.<br><br>**API**<br>[Delete Chat Messages](https://dev.twitch.tv/docs/api/reference#delete-chat-messages)<br>[Pin Chat Message](https://dev.twitch.tv/docs/api/reference#pin-chat-message)<br>[Update Pinned Chat Message](https://dev.twitch.tv/docs/api/reference#update-pinned-chat-message)<br>[Unpin Chat Message](https://dev.twitch.tv/docs/api/reference#unpin-chat-message)<br><br>**EventSub**<br>[Channel Moderate](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate) |
| `moderator:read:chat_settings` | View a broadcaster’s chat room settings.<br><br>**API**<br>[Get Chat Settings](https://dev.twitch.tv/docs/api/reference#get-chat-settings)<br><br>**EventSub**<br>[Channel Moderate](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate) |
| `moderator:manage:chat_settings` | Manage a broadcaster’s chat room settings.<br><br>**API**<br>[Update Chat Settings](https://dev.twitch.tv/docs/api/reference#update-chat-settings)<br><br>**EventSub**<br>[Channel Moderate](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate) |
| `moderator:read:chatters` | View the chatters in a broadcaster’s chat room.<br><br>**API**<br>[Get Chatters](https://dev.twitch.tv/docs/api/reference#get-chatters) |
| `moderator:read:followers` | Read the followers of a broadcaster.<br><br>**API**<br>[Get Channel Followers](https://dev.twitch.tv/docs/api/reference#get-channel-followers)<br><br>**EventSub**<br>[Channel Follow](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelfollow) |
| `moderator:read:guest_star` | Read Guest Star details for channels where you are a Guest Star moderator.<br><br>**API**<br>[Get Channel Guest Star Settings](https://dev.twitch.tv/docs/api/reference#get-channel-guest-star-settings)<br>[Get Guest Star Session](https://dev.twitch.tv/docs/api/reference#get-guest-star-session)<br>[Get Guest Star Invites](https://dev.twitch.tv/docs/api/reference#get-guest-star-invites)<br><br>**EventSub**<br>[Channel Guest Star Session Begin](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelguest_star_sessionbegin)<br>[Channel Guest Star Session End](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelguest_star_sessionend)<br>[Channel Guest Star Guest Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelguest_star_guestupdate)<br>[Channel Guest Star Settings Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelguest_star_settingsupdate) |
| `moderator:manage:guest_star` | Manage Guest Star for channels where you are a Guest Star moderator.<br><br>**API**<br>[Send Guest Star Invite](https://dev.twitch.tv/docs/api/reference#send-guest-star-invite)<br>[Delete Guest Star Invite](https://dev.twitch.tv/docs/api/reference#delete-guest-star-invite)<br>[Assign Guest Star Slot](https://dev.twitch.tv/docs/api/reference#assign-guest-star-slot)<br>[Update Guest Star Slot](https://dev.twitch.tv/docs/api/reference#update-guest-star-slot)<br>[Delete Guest Star Slot](https://dev.twitch.tv/docs/api/reference#delete-guest-star-slot)<br>[Update Guest Star Slot Settings](https://dev.twitch.tv/docs/api/reference#update-guest-star-slot-settings)<br><br>**EventSub**<br>[Channel Guest Star Session Begin](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelguest_star_sessionbegin)<br>[Channel Guest Star Session End](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelguest_star_sessionend)<br>[Channel Guest Star Guest Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelguest_star_guestupdate)<br>[Channel Guest Star Settings Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelguest_star_settingsupdate) |
| `moderator:read:moderators` | Read the list of moderators in channels where you have the moderator role.<br><br>**EventSub**<br>[Channel Moderate](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate)<br>[Channel Moderate v2](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate-v2) |
| `moderator:read:shield_mode` | View a broadcaster’s Shield Mode status.<br><br>**API**<br>[Get Shield Mode Status](https://dev.twitch.tv/docs/api/reference#get-shield-mode-status)<br><br>**EventSub**<br>[Shield Mode Begin](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelshield_modebegin)<br>[Shield Mode End](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelshield_modeend) |
| `moderator:manage:shield_mode` | Manage a broadcaster’s Shield Mode status.<br><br>**API**<br>[Update Shield Mode Status](https://dev.twitch.tv/docs/api/reference#update-shield-mode-status)<br><br>**EventSub**<br>[Shield Mode Begin](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelshield_modebegin)<br>[Shield Mode End](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelshield_modeend) |
| `moderator:read:shoutouts` | View a broadcaster’s shoutouts.<br><br>**EventSub**<br>[Shoutout Create](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelshoutoutcreate)<br>[Shoutout Received](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelshoutoutreceive) |
| `moderator:manage:shoutouts` | Manage a broadcaster’s shoutouts.<br><br>**API**<br>[Send a Shoutout](https://dev.twitch.tv/docs/api/reference#send-a-shoutout)<br><br>**EventSub**<br>[Shoutout Create](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelshoutoutcreate)<br>[Shoutout Received](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelshoutoutreceive) |
| `moderator:read:suspicious_users` | Read chat messages from suspicious users and see users flagged as suspicious in channels where the user has the moderator role.<br><br>**EventSub**<br>[Channel Suspicious User Message](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelsuspicious_usermessage)<br>[Channel Suspicious User Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelsuspicious_userupdate) |
| `moderator:manage:suspicious_users` | Manage suspicious user statuses in channels where the user has the moderator role.<br><br>**API**<br>[Add suspicious status to chat user](https://dev.twitch.tv/docs/api/reference/#add-suspicious-status-to-chat-user)<br>[Remove suspicious status from chat user](https://dev.twitch.tv/docs/api/reference/#remove-suspicious-status-from-chat-user) |
| `moderator:read:unban_requests` | View a broadcaster’s unban requests.<br><br>**API**<br>[Get Unban Requests](https://dev.twitch.tv/docs/api/reference/#get-unban-requests)<br><br>**EventSub**<br>[Channel Unban Request Create](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelunban_requestcreate)<br>[Channel Unban Request Resolve](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelunban_requestresolve)<br>[Channel Moderate](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate) |
| `moderator:manage:unban_requests` | Manage a broadcaster’s unban requests.<br><br>**API**<br>[Resolve Unban Requests](https://dev.twitch.tv/docs/api/reference/#resolve-unban-requests)<br><br>**EventSub**<br>[Channel Unban Request Create](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelunban_requestcreate)<br>[Channel Unban Request Resolve](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelunban_requestresolve)<br>[Channel Moderate](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate) |
| `moderator:read:vips` | Read the list of VIPs in channels where you have the moderator role.<br><br>**EventSub**<br>[Channel Moderate](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate)<br>[Channel Moderate v2](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate-v2) |
| `moderator:read:warnings` | Read warnings in channels where you have the moderator role.<br><br>**EventSub**<br>[Channel Moderate v2](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate-v2)<br>[Channel Warning Acknowledge](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelwarningacknowledge)<br>[Channel Warning Send](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelwarningsend) |
| `moderator:manage:warnings` | Warn users in channels where you have the moderator role.<br><br>**API**<br>[Warn Chat User](https://dev.twitch.tv/docs/api/reference#warn-chat-user)<br><br>**EventSub**<br>[Channel Moderate v2](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelmoderate-v2)<br>[Channel Warning Acknowledge](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelwarningacknowledge)<br>[Channel Warning Send](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelwarningsend) |
| `user:bot` | Join a specified chat channel as your user and appear as a bot, and perform chat-related actions as your user.<br><br>**API**<br>[Send Chat Message](https://dev.twitch.tv/docs/api/reference/#send-chat-message)<br><br>**EventSub**<br>[Channel Chat Clear](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatclear)<br>[Channel Chat Clear User Messages](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatclear_user_messages)<br>[Channel Chat Message](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage)<br>[Channel Chat Message Delete](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage_delete)<br>[Channel Chat Notification](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatnotification)<br>[Channel Chat Settings Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchat_settingsupdate)<br>[Channel Chat User Message Hold](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchat_user_message_hold)<br>[Channel Chat User Message Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatuser_message_update) |
| `user:edit` | Manage a user object.<br><br>**API**<br>[Update User](https://dev.twitch.tv/docs/api/reference#update-user) |
| `user:edit:broadcast` | View and edit a user’s broadcasting configuration, including Extension configurations.<br><br>**API**<br>[Get User Extensions](https://dev.twitch.tv/docs/api/reference/#get-user-extensions)<br>[Get User Active Extensions](https://dev.twitch.tv/docs/api/reference/#get-user-active-extensions)<br>[Update User Extensions](https://dev.twitch.tv/docs/api/reference/#update-user-extensions) |
| `user:read:blocked_users` | View the block list of a user.<br><br>**API**<br>[Get User Block List](https://dev.twitch.tv/docs/api/reference#get-user-block-list) |
| `user:manage:blocked_users` | Manage the block list of a user.<br><br>**API**<br>[Block User](https://dev.twitch.tv/docs/api/reference#block-user)<br>[Unblock User](https://dev.twitch.tv/docs/api/reference#unblock-user) |
| `user:read:broadcast` | View a user’s broadcasting configuration, including Extension configurations.<br><br>**API**<br>[Get Stream Markers](https://dev.twitch.tv/docs/api/reference#get-stream-markers)<br>[Get User Extensions](https://dev.twitch.tv/docs/api/reference#get-user-extensions)<br>[Get User Active Extensions](https://dev.twitch.tv/docs/api/reference#get-user-active-extensions) |
| `user:read:chat` | Receive chatroom messages and informational notifications relating to a channel’s chatroom.<br><br>**EventSub**<br>[Channel Chat Clear](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatclear)<br>[Channel Chat Clear User Messages](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatclear_user_messages)<br>[Channel Chat Message](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage)<br>[Channel Chat Message Delete](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage_delete)<br>[Channel Chat Notification](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatnotification)<br>[Channel Chat Settings Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchat_settingsupdate)<br>[Channel Chat User Message Hold](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatuser_message_hold)<br>[Channel Chat User Message Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatuser_message_update) |
| `user:manage:chat_color` | Update the color used for the user’s name in chat.<br><br>**API**<br>[Update User Chat Color](https://dev.twitch.tv/docs/api/reference#update-user-chat-color) |
| `user:read:email` | View a user’s email address.<br><br>**API**<br>[Get Users](https://dev.twitch.tv/docs/api/reference#get-users) (optional)<br>[Update User](https://dev.twitch.tv/docs/api/reference/#update-user) (optional)<br><br>**EventSub**<br>[User Update](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#userupdate) (optional) |
| `user:read:emotes` | View emotes available to a user<br><br>**API**<br>[Get User Emotes](https://dev.twitch.tv/docs/api/reference/#get-user-emotes) |
| `user:read:follows` | View the list of channels a user follows.<br><br>**API**<br>[Get Followed Channels](https://dev.twitch.tv/docs/api/reference#get-followed-channels)<br>[Get Followed Streams](https://dev.twitch.tv/docs/api/reference#get-followed-streams) |
| `user:read:moderated_channels` | Read the list of channels you have moderator privileges in.<br><br>**API**<br>[Get Moderated Channels](https://dev.twitch.tv/docs/api/reference#get-moderated-channels) |
| `user:read:subscriptions` | View if an authorized user is subscribed to specific channels.<br><br>**API**<br>[Check User Subscription](https://dev.twitch.tv/docs/api/reference#check-user-subscription) |
| `user:read:whispers` | Receive whispers sent to your user.<br><br>**EventSub**<br>[Whisper Received](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#userwhispermessage) |
| `user:manage:whispers` | Receive whispers sent to your user, and send whispers on your user’s behalf.<br><br>**API**<br>[Send Whisper](https://dev.twitch.tv/docs/api/reference#send-whisper)<br><br>**EventSub**<br>[Whisper Received](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#userwhispermessage) |
| `user:write:chat` | Send chat messages to a chatroom.<br><br>**API**<br>[Send Chat Message](https://dev.twitch.tv/docs/api/reference/#send-chat-message) |

## IRC Chat Scopes

| Scope Name | Type of Access |
|---|---|
| `chat:edit` | Send chat messages to a chatroom using an IRC connection. |
| `chat:read` | View chat messages sent in a chatroom using an IRC connection. |

## PubSub-specific Chat Scopes

| Scope Name | Type of Access |
|---|---|
| `whispers:read` | Receive whisper messages for your user using PubSub. |

## Every scope, in the order above

```
analytics:read:extensions
analytics:read:games
bits:read
channel:bot
channel:manage:ads
channel:read:ads
channel:manage:broadcast
channel:read:charity
channel:manage:clips
channel:edit:commercial
channel:read:editors
channel:manage:extensions
channel:read:goals
channel:read:guest_star
channel:manage:guest_star
channel:read:hype_train
channel:manage:moderators
channel:read:polls
channel:manage:polls
channel:read:predictions
channel:manage:predictions
channel:manage:raids
channel:read:redemptions
channel:manage:redemptions
channel:manage:schedule
channel:read:stream_key
channel:read:subscriptions
channel:manage:videos
channel:read:vips
channel:manage:vips
channel:moderate
clips:edit
editor:manage:clips
moderation:read
moderator:manage:announcements
moderator:manage:automod
moderator:read:automod_settings
moderator:manage:automod_settings
moderator:read:banned_users
moderator:manage:banned_users
moderator:read:blocked_terms
moderator:manage:blocked_terms
moderator:read:chat_messages
moderator:manage:chat_messages
moderator:read:chat_settings
moderator:manage:chat_settings
moderator:read:chatters
moderator:read:followers
moderator:read:guest_star
moderator:manage:guest_star
moderator:read:moderators
moderator:read:shield_mode
moderator:manage:shield_mode
moderator:read:shoutouts
moderator:manage:shoutouts
moderator:read:suspicious_users
moderator:manage:suspicious_users
moderator:read:unban_requests
moderator:manage:unban_requests
moderator:read:vips
moderator:read:warnings
moderator:manage:warnings
user:bot
user:edit
user:edit:broadcast
user:read:blocked_users
user:manage:blocked_users
user:read:broadcast
user:read:chat
user:manage:chat_color
user:read:email
user:read:emotes
user:read:follows
user:read:moderated_channels
user:read:subscriptions
user:read:whispers
user:manage:whispers
user:write:chat
chat:edit
chat:read
whispers:read
```
