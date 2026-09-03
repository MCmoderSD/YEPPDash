import { Data, Route, Routes } from '@angular/router';
import { ModuleBlockedComponent } from '../components/module-blocked-component/module-blocked.component';
import { channelPointsMatch } from '../services/channel-points.guard';

const CHANNEL_POINTS_BLOCK: Data = {
  icon: 'toll',
  label: 'Channel points required',
  heading: 'This module needs channel points',
  reason: 'Everything under Rewards is built on channel points, and Twitch only hands those to '
    + 'Affiliates and Partners. Until your channel is one of the two and has channel points '
    + 'switched on, there is no reward for YEPPDash to create or listen to.',
  note: 'If you have only just been accepted, reload this page — your status is read once per '
    + 'visit, so it is not noticed until then.',
};

export function channelPointsGated(route: Route): Routes {
  return [
    { ...route, canMatch: [...route.canMatch ?? [], channelPointsMatch] },
    { path: route.path, title: route.title, component: ModuleBlockedComponent, data: CHANNEL_POINTS_BLOCK },
  ];
}