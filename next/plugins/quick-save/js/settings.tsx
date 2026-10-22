import Page from '@revenge-mod/components/Page'
import { Design } from '@revenge-mod/discord/design'
import { useMemo, useState } from 'react'
import { ScrollView } from 'react-native'
import { describeChannel, getChannel, listChannels, parseChannelId, pathError } from './rules'
import type { PluginSettingsComponent } from '@revenge-mod/plugins/types'
import type { ComponentProps } from 'react'
import type { Rule, Settings } from './rules'

const { Button, Card, Stack, TableRow, TableRowGroup, Text, TextInput } = Design

type Props = ComponentProps<PluginSettingsComponent<{ jsonStorage: Settings }>>

const MAX_RESULTS = 25

export default function SettingsComponent({ api: { jsonStorage } }: Props) {
	const rules = jsonStorage.use()?.rules ?? []
	// Arrays aren't deep-merged by jsonStorage.set, so this replaces the whole list.
	const setRules = (next: Rule[]) => jsonStorage.set({ rules: next })

	const [query, setQuery] = useState('')
	const pastedId = parseChannelId(query)
	const searching = query.trim().length > 0 && !pastedId
	// Listing every channel is the expensive part, so only do it once per search session.
	const channels = useMemo(() => (searching ? listChannels() : []), [searching])
	const results = useMemo(() => {
		const q = query.trim().toLowerCase()
		const taken = new Set(rules.map(r => r.channelId))
		return channels
			.filter(c => !taken.has(c.id) && (c.name.toLowerCase().includes(q) || c.guild.toLowerCase().includes(q)))
			.slice(0, MAX_RESULTS)
	}, [channels, query, rules])

	const addRule = (channelId: string, name?: string) => {
		setRules([...rules, { channelId, path: `Pictures/${name ?? 'Discord'}` }])
		setQuery('')
	}
	const pastedChannel = pastedId ? getChannel(pastedId) : undefined
	const pastedTaken = pastedId ? rules.some(r => r.channelId === pastedId) : false

	return (
		<ScrollView keyboardShouldPersistTaps="handled">
			<Page>
				<Text variant="text-sm/medium" color="text-muted">
					Przycisk pobierania w podglądzie zapisuje pliki z tych kanałów do wybranego folderu (wątki i posty na
					forum też się liczą). Kanał możesz wyszukać po nazwie albo wkleić jego ID, link do wiadomości lub link
					do załącznika z tego kanału. Ścieżka musi zaczynać się od Pictures, DCIM, Download, Movies, Music albo
					Documents, np. Pictures/Funny. Pozostałe kanały zapisują się jak zwykle.
				</Text>

				<TableRowGroup title="Kanały i foldery">
					{rules.length ? (
						rules.map(rule => (
							<RuleCard
								key={rule.channelId}
								rule={rule}
								onPathChange={path =>
									setRules(rules.map(r => (r.channelId === rule.channelId ? { ...r, path } : r)))
								}
								onRemove={() => setRules(rules.filter(r => r.channelId !== rule.channelId))}
							/>
						))
					) : (
						<TableRow label="Brak kanałów" subLabel="Wyszukaj kanał poniżej, żeby go dodać." />
					)}
				</TableRowGroup>

				<Stack>
					<TextInput
						label="Dodaj kanał"
						placeholder="Nazwa kanału, ID albo link do załącznika"
						value={query}
						onChange={setQuery}
						isClearable
					/>
					{pastedId && (
						<TableRowGroup title="Kanał z ID">
							<TableRow
								label={pastedChannel ? describeChannel(pastedId).name : `Kanał ${pastedId}`}
								subLabel={
									pastedTaken
										? 'Ten kanał jest już na liście'
										: (describeChannel(pastedId).guild ??
											(pastedChannel ? undefined : 'Nie znam tego kanału, ale reguła i tak zadziała'))
								}
								arrow={!pastedTaken}
								onPress={pastedTaken ? undefined : () => addRule(pastedId, pastedChannel?.name)}
							/>
						</TableRowGroup>
					)}
					{searching && (
						<TableRowGroup title={results.length ? 'Wyniki' : 'Brak wyników'}>
							{results.map(channel => (
								<TableRow
									key={channel.id}
									label={`#${channel.name}`}
									subLabel={channel.guild}
									arrow
									onPress={() => addRule(channel.id, channel.name)}
								/>
							))}
						</TableRowGroup>
					)}
				</Stack>
			</Page>
		</ScrollView>
	)
}

function RuleCard({
	rule,
	onPathChange,
	onRemove,
}: {
	rule: Rule
	onPathChange: (path: string) => void
	onRemove: () => void
}) {
	const { name, guild } = describeChannel(rule.channelId)
	const [error, setError] = useState(pathError(rule.path))

	return (
		<Card>
			<Stack spacing={8}>
				<Text variant="text-md/semibold">{guild ? `${name} · ${guild}` : name}</Text>
				<TextInput
					label="Folder"
					placeholder="Pictures/Funny"
					defaultValue={rule.path}
					status={error ? 'error' : 'default'}
					errorMessage={error}
					onChange={(value: string) => {
						const err = pathError(value)
						setError(err)
						if (!err) onPathChange(value.trim())
					}}
				/>
				<Button variant="destructive" size="sm" text="Usuń" onPress={onRemove} />
			</Stack>
		</Card>
	)
}
