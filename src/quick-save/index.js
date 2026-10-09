(() => {
	// QuickSave: a Save button in the media viewer header, next to the "..." menu.
	// Vendetta-format plugin (Revenge loads it from a URL). The file is evaluated as
	// `vendetta => { return <this file> }`, so it must be a single expression.
	//
	// The header (MediaModalOverlayHeader) renders a row: [fav button] [ContextMenu(items) -> "..." button].
	// The ContextMenu's first item is Discord's own Save ({ label, IconComponent, action }), so the new
	// button just reuses that item: same download logic, same full-resolution file, same toast.
	const { metro, patcher, utils, logger } = vendetta
	const { React } = metro.common
	const { findInReactTree } = utils

	const TAG = '[QuickSave]'
	const unpatches = []

	const isMenu = n => Array.isArray(n?.props?.items) && typeof n.props.children === 'function'
	const isHeaderButton = n => n?.props && 'icon' in n.props && 'onPress' in n.props && 'accessibilityLabel' in n.props

	function findSaveItem(items) {
		const DownloadIcon = metro.findByProps('DownloadIcon')?.DownloadIcon
		return (
			items.find(it => DownloadIcon && it?.IconComponent === DownloadIcon) ??
			items.find(it => /^(save|zapisz)/i.test(it?.label ?? ''))
		)
	}

	function injectSaveButton(ret) {
		const row = findInReactTree(ret, n => Array.isArray(n?.props?.children) && n.props.children.some(isMenu))
		if (!row) return
		const kids = row.props.children
		if (kids.some(c => c?.key === 'quicksave')) return

		const menuIndex = kids.findIndex(isMenu)
		const save = findSaveItem(kids[menuIndex].props.items)
		// The close button uses the same overlay icon-button component as "...".
		const button = findInReactTree(ret, isHeaderButton)
		if (!save || !button) return

		const saveButton = React.createElement(button.type, {
			key: 'quicksave',
			accessibilityLabel: save.label,
			onPress: save.action,
			icon: React.createElement(save.IconComponent, { size: 'md', color: 'interactive-text-active' }),
		})
		row.props.children = [...kids.slice(0, menuIndex), saveButton, ...kids.slice(menuIndex)]
	}

	return {
		onLoad() {
			const Header = metro.findByProps('MediaModalOverlayHeader')
			if (!Header) return logger.error(TAG, 'MediaModalOverlayHeader not found')

			unpatches.push(
				patcher.after('MediaModalOverlayHeader', Header, (_args, ret) => {
					try {
						injectSaveButton(ret)
					} catch (e) {
						logger.error(TAG, e)
					}
					return ret
				}),
			)
		},
		onUnload() {
			for (const unpatch of unpatches.splice(0)) unpatch()
		},
	}
})()
