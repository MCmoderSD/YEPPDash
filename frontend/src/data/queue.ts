export enum QueueRequirement {
  Everyone = 'Everyone',
  Follower = 'Follower',
  Subscriber = 'Subscriber',
  Vip = 'Vip',
}

export interface Queue {
  isOpen: boolean;
  requirement: QueueRequirement;
  entries: string[];
}

export const QUEUE_REQUIREMENTS: readonly QueueRequirement[] = [
  QueueRequirement.Everyone,
  QueueRequirement.Follower,
  QueueRequirement.Subscriber,
  QueueRequirement.Vip,
];

export const QUEUE_REQUIREMENT_LABELS: Readonly<Record<QueueRequirement, string>> = {
  [QueueRequirement.Everyone]: 'Everyone',
  [QueueRequirement.Follower]: 'Followers',
  [QueueRequirement.Subscriber]: 'Subscribers',
  [QueueRequirement.Vip]: 'VIPs',
};

// The four levels are not a ladder, and that surprises people: a VIP who has never subscribed is
// turned away by Subscribers, and every subscriber is turned away by VIPs. The hints say so rather
// than leaving it to be discovered live.
export const QUEUE_REQUIREMENT_HINTS: Readonly<Record<QueueRequirement, string>> = {
  [QueueRequirement.Everyone]: 'Anyone in chat can join the queue.',
  [QueueRequirement.Follower]: 'Only people who follow the channel can join.',
  [QueueRequirement.Subscriber]: 'Only subscribers can join — a VIP without a sub cannot.',
  [QueueRequirement.Vip]: 'Only VIPs can join — subscribers without VIP cannot.',
};

export const EMPTY_QUEUE: Queue = {
  isOpen: false,
  requirement: QueueRequirement.Everyone,
  entries: [],
};
