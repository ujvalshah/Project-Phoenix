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
  /**
   * Optional. Omitted when the source has no real title — avoids Android
   * share-target chooser prefilling a generic placeholder as email subject.
   */
  title?: string;
  text: string;
  url: string;
}

