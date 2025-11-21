import type { Component, JSX } from 'solid-js'

interface ExternalLinkProps {
  href: string
  children: JSX.Element
  title?: string
  class?: string
}

export const ExternalLink: Component<ExternalLinkProps> = (props) => {
  return (
    <a
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      title={props.title}
      class={`transition-colors hover:text-emerald-300 ${props.class || ''}`}
    >
      {props.children}
    </a>
  )
}
