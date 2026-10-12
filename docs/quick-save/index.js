(() => {
	// QuickSave: Copy link + Save buttons in the media viewer header, next to the "..." menu.
	// Vendetta-format plugin (Revenge loads it from a URL). The file is evaluated as
	// `vendetta => { return <this file> }`, so it must be a single expression.
	//
	// The header (MediaModalOverlayHeader) renders a row: [fav button] [ContextMenu(items) -> "..." button].
	// The ContextMenu's first item is Discord's own Save ({ label, IconComponent, action }), so the new
	// button just reuses that item: same download logic, same full-resolution file, same toast.
	// The copy button copies the same link as "..." -> Share -> Copy (source.shareURI).
	const { metro, patcher, utils, logger, ui } = vendetta
	const { React, ReactNative: RN, clipboard } = metro.common
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

	function headerIcon(Component, assetName) {
		if (Component) return React.createElement(Component, { size: 'md', color: 'interactive-text-active' })
		return React.createElement(RN.Image, {
			source: ui.assets.getAssetIDByName(assetName),
			style: { width: 24, height: 24, tintColor: '#FFFFFF' },
		})
	}

	function copyLink(source) {
		const url = source.shareURI || source.sourceURI || source.uri
		clipboard.setString(url)
		ui.toasts.showToast('Skopiowano link', ui.assets.getAssetIDByName('LinkIcon'))
	}

	function injectButtons(ret, source) {
		const row = findInReactTree(ret, n => Array.isArray(n?.props?.children) && n.props.children.some(isMenu))
		if (!row) return
		const kids = row.props.children
		if (kids.some(c => String(c?.key).startsWith('quicksave'))) return

		// The close button uses the same overlay icon-button component as "...".
		const button = findInReactTree(ret, isHeaderButton)
		if (!button) return

		const menuIndex = kids.findIndex(isMenu)
		const added = []

		if (source && (source.shareURI || source.sourceURI || source.uri)) {
			added.push(
				React.createElement(button.type, {
					key: 'quicksave-copy',
					accessibilityLabel: 'Copy Link',
					onPress: () => copyLink(source),
					icon: headerIcon(metro.findByProps('LinkIcon')?.LinkIcon, 'LinkIcon'),
				}),
			)
		}

		const save = findSaveItem(kids[menuIndex].props.items)
		if (save) {
			added.push(
				React.createElement(button.type, {
					key: 'quicksave',
					accessibilityLabel: save.label,
					onPress: save.action,
					icon: headerIcon(save.IconComponent, 'DownloadIcon'),
				}),
			)
		}

		row.props.children = [...kids.slice(0, menuIndex), ...added, ...kids.slice(menuIndex)]
	}

	return {
		onLoad() {
			const Header = metro.findByProps('MediaModalOverlayHeader')
			if (!Header) return logger.error(TAG, 'MediaModalOverlayHeader not found')

			unpatches.push(
				patcher.after('MediaModalOverlayHeader', Header, (args, ret) => {
					try {
						injectButtons(ret, args[0]?.source)
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
