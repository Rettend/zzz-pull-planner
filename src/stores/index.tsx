import type { Accessor, ParentProps } from 'solid-js'
import type { GameData } from '~/remote/game'
import type { ProfileData } from '~/types/profile'
import { GameDataProvider } from './game'
import { ProfilesStoreProvider } from './profiles'
import { UIStoreProvider } from './ui'

interface RootStoreProviderProps extends ParentProps {
  gameData: Accessor<GameData | undefined>
  profiles: Accessor<ProfileData[] | undefined>
}

export function RootStoreProvider(props: RootStoreProviderProps) {
  return (
    <GameDataProvider data={props.gameData}>
      <ProfilesStoreProvider serverProfiles={props.profiles}>
        <UIStoreProvider>
          {props.children}
        </UIStoreProvider>
      </ProfilesStoreProvider>
    </GameDataProvider>
  )
}
