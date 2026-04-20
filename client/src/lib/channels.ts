import { api } from "./api";
import type { ChannelType, EmailChannelConfig } from "../../../shared/schema";

export type { ChannelType, EmailChannelConfig };

export interface ChannelConfigResponse<C = unknown> {
  channelType: ChannelType;
  enabled: boolean;
  config: C;
  updatedAt: string | null;
}

export interface ChannelConfigPatch<C = unknown> {
  enabled?: boolean;
  config?: Partial<C>;
}

export const channelsApi = {
  getConfig: <C = unknown>(channelType: ChannelType) =>
    api.get<ChannelConfigResponse<C>>(`/api/channels/${channelType}/config`),
  saveConfig: <C = unknown>(channelType: ChannelType, body: ChannelConfigPatch<C>) =>
    api.patch<ChannelConfigResponse<C>>(`/api/channels/${channelType}/config`, body),
};
