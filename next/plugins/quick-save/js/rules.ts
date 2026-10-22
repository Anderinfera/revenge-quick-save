import { Stores } from '@revenge-mod/discord/flux'

export interface Rule {
	channelId: string
	/** Public folder, e.g. `Pictures/Funny`. Normalized and validated again on the native side. */
	path: string
}

export interface Settings {
	rules: Rule[]
}

const PUBLIC_DIRS = ['Pictures', 'DCIM', 'Download', 'Movies', 'Music', 'Documents']

/** Mirror of the native check, so the settings screen can show the error while typing. */
export function pathError(path: string): string | undefined {
	const parts = path
		.trim()
		.replace(/\\/g, '/')
		.replace(/^\/storage\/emulated\/0|^\/sdcard/, '')
		.split('/')
		.filter(p => p && p !== '.')
	if (!parts.length) return 'Wpisz ścieżkę, np. Pictures/Funny'
	if (parts.includes('..')) return "Ścieżka nie może zawierać '..'"
	const first = /^downloads$/i.test(parts[0]!) ? 'Download' : parts[0]!
	if (!PUBLIC_DIRS.some(d => d.toLowerCase() === first.toLowerCase()))
		return `Ścieżka musi zaczynać się od: ${PUBLIC_DIRS.join(', ')}`
}

const stores = Stores as Record<string, any>

export function getChannel(id: string | undefined): any {
	return id ? stores.ChannelStore?.getChannel?.(id) : undefined
}

/** A rule for the channel itself, or for the parent channel of a thread / forum post. */
export function findRule(rules: Rule[] | undefined, channelId: string | undefined): Rule | undefined {
	if (!rules?.length || !channelId) return
	const parentId = getChannel(channelId)?.parent_id
	return rules.find(r => r.channelId === channelId) ?? rules.find(r => r.channelId === parentId)
}

export function describeChannel(id: string): { name: string; guild?: string } {
	const channel = getChannel(id)
	if (!channel) return { name: `Nieznany kanał (${id})` }
	const guild = channel.guild_id ? stores.GuildStore?.getGuild?.(channel.guild_id)?.name : undefined
	return { name: `#${channel.name ?? id}`, guild }
}

// Text, announcement, forum and media channels: the ones images get posted in.
const POSTABLE_TYPES = new Set([0, 5, 15, 16])

export interface ChannelOption {
	id: string
	name: string
	guild: string
}

/** Channels of every server the user is in. */
export function listChannels(): ChannelOption[] {
	const guilds: any[] = Object.values(stores.GuildStore?.getGuilds?.() ?? {})
	const out: ChannelOption[] = []

	for (const guild of guilds) {
		const selectable = stores.GuildChannelStore?.getChannels?.(guild.id)?.SELECTABLE
		const channels: any[] = selectable
			? selectable.map((entry: any) => entry.channel ?? entry)
			: Object.values(stores.ChannelStore?.getMutableGuildChannelsForGuild?.(guild.id) ?? {})

		for (const channel of channels)
			if (channel && POSTABLE_TYPES.has(channel.type))
				out.push({ id: channel.id, name: channel.name, guild: guild.name })
	}

	return out
}

export function fullResUrl(source: any): string {
	return source?.sourceURI || source?.uri
}

export function fileNameOf(source: any): string {
	const url: string = fullResUrl(source) ?? ''
	return source?.filename || decodeURIComponent(url.split('?')[0]!.split('/').pop() || 'file')
}
