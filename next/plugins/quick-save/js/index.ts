// QuickSave for Revenge Next: Copy link + Save buttons in the media viewer header, next to "...".
//
// The header (MediaModalOverlayHeader) renders a row: [fav button] [ContextMenu(items) -> "..." button].
// The ContextMenu's Save item ({ label, IconComponent, action }) is Discord's own Save, so the new button
// reuses it: same download logic, same full-resolution file. Copy link copies source.shareURI, the same
// link as "..." -> Share -> Copy. No toasts: legacy toasts crash Discord's ToastContainer on newer builds.
import { createElement } from 'react'
import { Clipboard } from '@revenge-mod/externals/react-native-clipboard'
import { getModules, lookupModule } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import { instead } from '@revenge-mod/patcher'

type Node = any

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

const icon = (name: string) => (lookupModule(withProps(name)) as any)[0]?.[name]

function findSaveItem(items: Node[]) {
	const DownloadIcon = icon('DownloadIcon')
	return (
		items.find(it => DownloadIcon && it?.IconComponent === DownloadIcon) ??
		items.find(it => /^(save|zapisz)/i.test(it?.label ?? ''))
	)
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

	const url = source?.shareURI || source?.sourceURI || source?.uri
	const LinkIcon = icon('LinkIcon')
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

	const save = findSaveItem(kids[menuIndex].props.items)
	if (save) {
		added.push(
			createElement(button.type, {
				key: 'quicksave',
				accessibilityLabel: save.label,
				onPress: save.action,
				icon: iconEl(save.IconComponent),
			}),
		)
	}

	row.props.children = [...kids.slice(0, menuIndex), ...added, ...kids.slice(menuIndex)]
}

export default plugin({
	start({ cleanup, logger }) {
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
})
