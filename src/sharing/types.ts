export type ShareEntityType = 'nugget' | 'collection';

export interface ShareItemData {
  type: ShareEntityType;
  id: string;
  title?: string;
  shareUrl: string;
}

export interface ShareMeta {
  text?: string;
}

export interface ShareContext {
  surface: string;
}

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

