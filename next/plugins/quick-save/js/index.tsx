// QuickSave for Revenge Next: Copy link + Save buttons in the media viewer header, next to "...".
//
// The header (MediaModalOverlayHeader) renders a row: [fav button] [ContextMenu(items) -> "..." button].
// The ContextMenu's Save item ({ label, IconComponent, action }) is Discord's own Save, so the new button
// reuses it. If the media's channel has a folder rule (set in the plugin settings), Save instead goes through
// the native half (QuickSave.kt), which downloads the file into that folder.
// Copy link copies source.shareURI, the same link as "..." -> Share -> Copy.
// No JS toasts: legacy toasts crash Discord's ToastContainer on newer builds (the native side uses Android toasts).
import { createElement } from 'react'
import { Clipboard } from '@revenge-mod/externals/react-native-clipboard'
import { getModules, lookupModule } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import { callNativeMethod } from '@revenge-mod/modules/native'
import { instead } from '@revenge-mod/patcher'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import { fileNameOf, findRule, fullResUrl } from './rules'
import SettingsComponent from './settings'
import type { Settings } from './rules'

type Node = any

const SAVE_TO_METHOD = 'anderinfera.quick-save.saveTo'

function findInTree(tree: Node, filter: (n: Node) => boolean): Node {
	const stack = [tree]
	while (stack.length) {
		const node = stack.pop()
		if (!node || typeof node !== 'object') continue
		if (filter(node)) return node
		if (Array.isArray(node)) stack.push(...node)
		else if (node.props?.children) stack.push(node.props.children)
	}
}

const isMenu = (n: Node) => Array.isArray(n?.props?.items) && typeof n.props.children === 'function'
const isHeaderButton = (n: Node) =>
	n?.props && 'icon' in n.props && 'onPress' in n.props && 'accessibilityLabel' in n.props

// Icon modules are lazy: withProps only sees initialized ones, while the generated-icon lookup also
// finds (and initializes) icons nothing has rendered yet.
const icon = (name: string): any =>
	lookupGeneratedIconComponent(name) ?? (lookupModule(withProps(name)) as any)[0]?.[name]

function findSaveItem(items: Node[]) {
	const DownloadIcon = icon('DownloadIcon')
	return (
		items.find(it => DownloadIcon && it?.IconComponent === DownloadIcon) ??
		items.find(it => /^(save|zapisz)/i.test(it?.label ?? ''))
	)
}

export default plugin<{ jsonStorage: Settings }>({
	jsonStorage: {
		load: true,
		default: { rules: [] },
	},
	start({ cleanup, logger, jsonStorage }) {
		function save(source: Node, discordSave: () => void) {
			const rule = findRule(jsonStorage.cache?.rules, source?.channelId)
			if (!rule) return discordSave()

			const args = [fullResUrl(source), rule.path, fileNameOf(source), source?.contentType ?? null]
			;(callNativeMethod as any)(SAVE_TO_METHOD, args).catch((e: unknown) => {
				// The native side already showed an Android toast for real save errors.
				// Only fall back when the native half isn't loaded at all.
				if (String(e).includes('not registered')) discordSave()
				logger.error('QuickSave: saving to folder failed', e)
			})
		}

		function injectButtons(ret: Node, source: Node) {
			const row = findInTree(ret, n => Array.isArray(n?.props?.children) && n.props.children.some(isMenu))
			if (!row) return
			const kids: Node[] = row.props.children
			if (kids.some(c => String(c?.key).startsWith('quicksave'))) return

			// The close button uses the same overlay icon-button component as "...".
			const button = findInTree(ret, isHeaderButton)
			if (!button) return

			const iconEl = (Component: Node) => createElement(Component, { size: 'md', color: 'interactive-text-active' })
			const menuIndex = kids.findIndex(isMenu)
			const added: Node[] = []

			const items: Node[] = kids[menuIndex].props.items
			const url = source?.shareURI || source?.sourceURI || source?.uri
			// Never drop the button over a missing icon: fall back to the menu's own Share / Open in Browser icons.
			const LinkIcon = icon('LinkIcon') ?? items[2]?.IconComponent ?? items[items.length - 1]?.IconComponent
			if (url && LinkIcon) {
				added.push(
					createElement(button.type, {
						key: 'quicksave-copy',
						accessibilityLabel: 'Copy Link',
						onPress: () => Clipboard.setString(url),
						icon: iconEl(LinkIcon),
					}),
				)
			}

			const saveItem = findSaveItem(items)
			if (saveItem) {
				added.push(
					createElement(button.type, {
						key: 'quicksave',
						accessibilityLabel: saveItem.label,
						onPress: () => save(source, saveItem.action),
						icon: iconEl(saveItem.IconComponent),
					}),
				)
			}

			row.props.children = [...kids.slice(0, menuIndex), ...added, ...kids.slice(menuIndex)]
		}

		cleanup(
			// Fires now if the module is already loaded, or later when Discord loads it.
			getModules(withProps('MediaModalOverlayHeader'), (Header: any) => {
				cleanup(
					instead(Header, 'MediaModalOverlayHeader', function (this: any, args: any[], original: any) {
						const ret = original.apply(this, args)
						try {
							injectButtons(ret, args[0]?.source)
						} catch (e) {
							logger.error('QuickSave:', e)
						}
						return ret
					}),
				)
			}),
		)
	},
	SettingsComponent,
})
