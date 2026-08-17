import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import * as stylex from "@stylexjs/stylex";
import { XIcon } from "lucide-react";
import type * as React from "react";

import type { CenteredPopupStyle, StyledProps } from "~/styles/style-props";
import { media, motion, radius } from "~/styles/tokens.stylex";

const fadeIn = stylex.keyframes({ from: { opacity: 0 } });
const fadeOut = stylex.keyframes({ to: { opacity: 0 } });
const popIn = stylex.keyframes({ from: { opacity: 0, transform: "scale(0.95)" } });
const popOut = stylex.keyframes({ to: { opacity: 0, transform: "scale(0.95)" } });

const styles = stylex.create({
	overlay: {
		animationDuration: motion.duration,
		animationName: {
			default: null,
			":is([data-open])": fadeIn,
			":is([data-closed])": fadeOut,
			[media.reducedMotion]: "none",
		},
		animationTimingFunction: "ease",
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		inset: 0,
		position: "fixed",
		zIndex: 50,
	},
	popup: {
		animationDuration: "0.2s",
		animationName: {
			default: null,
			":is([data-open])": popIn,
			":is([data-closed])": popOut,
			[media.reducedMotion]: "none",
		},
		animationTimingFunction: "ease",
		backgroundColor: "oklch(100% 0 0)",
		borderRadius: radius.lg,
		borderWidth: 1,
		boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
		display: "grid",
		gap: 16,
		left: "50%",
		maxWidth: { default: "calc(100% - 2rem)", [media.sm]: "32rem" },
		overscrollBehavior: "contain",
		padding: 24,
		position: "fixed",
		top: "50%",
		translate: "-50% -50%",
		width: "100%",
		zIndex: 50,
	},
	close: {
		borderRadius: radius.xs,
		opacity: { default: 0.7, ":hover": 1 },
		position: "absolute",
		right: 16,
		top: 16,
		transitionDuration: motion.duration,
		transitionProperty: "opacity",
		transitionTimingFunction: motion.easing,
		backgroundColor: { default: null, ":is([data-open])": "oklch(97% 0 0)" },
		color: { default: null, ":is([data-open])": "oklch(55.6% 0 0)" },
		boxShadow: {
			default: null,
			":focus": "0 0 0 2px oklch(100% 0 0), 0 0 0 4px oklch(70.8% 0 0)",
		},
		outline: { default: null, ":focus": "2px solid transparent" },
		pointerEvents: { default: null, ":disabled": "none" },
	},
	closeIcon: {
		height: 16,
		pointerEvents: "none",
		flexShrink: 0,
		width: 16,
	},
	srOnly: {
		borderWidth: 0,
		clipPath: "inset(50%)",
		height: 1,
		margin: -1,
		overflow: "hidden",
		padding: 0,
		position: "absolute",
		whiteSpace: "nowrap",
		width: 1,
	},
	header: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
		textAlign: { default: "center", [media.sm]: "left" },
	},
	footer: {
		display: "flex",
		flexDirection: { default: "column-reverse", [media.sm]: "row" },
		gap: 8,
		justifyContent: { default: null, [media.sm]: "flex-end" },
	},
	title: {
		fontSize: "1.125rem",
		fontWeight: 600,
		lineHeight: 1,
	},
});

export const Dialog = DialogPrimitive.Root;

type DialogContentProps = StyledProps<DialogPrimitive.Popup.Props, CenteredPopupStyle> & {
	showCloseButton?: boolean;
};

export function DialogContent({
	style,
	children,
	showCloseButton = true,
	...props
}: DialogContentProps) {
	return (
		<DialogPrimitive.Portal>
			<DialogPrimitive.Backdrop {...stylex.props(styles.overlay)} />
			<DialogPrimitive.Popup {...props} {...stylex.props(styles.popup, style)}>
				{children}
				{showCloseButton && (
					<DialogPrimitive.Close {...stylex.props(styles.close)}>
						<XIcon {...stylex.props(styles.closeIcon)} />
						<span {...stylex.props(styles.srOnly)}>Close</span>
					</DialogPrimitive.Close>
				)}
			</DialogPrimitive.Popup>
		</DialogPrimitive.Portal>
	);
}

export function DialogHeader({ style, ...props }: StyledProps<React.ComponentProps<"div">>) {
	return <div {...props} {...stylex.props(styles.header, style)} />;
}

export function DialogFooter({ style, ...props }: StyledProps<React.ComponentProps<"div">>) {
	return <div {...props} {...stylex.props(styles.footer, style)} />;
}

export function DialogTitle({ style, ...props }: StyledProps<DialogPrimitive.Title.Props>) {
	return <DialogPrimitive.Title {...props} {...stylex.props(styles.title, style)} />;
}
