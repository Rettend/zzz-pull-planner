import type { Accessor, ParentProps } from 'solid-js'
import type { GameData } from '~/remote/game'
import type { Profile } from '~/types/profile'
import { GameDataProvider } from './game'
import { ProfilesStoreProvider } from './profiles'
import { PullHistoryProvider } from './pullHistory'
import { UIStoreProvider } from './ui'

interface RootStoreProviderProps extends ParentProps {
  gameData: Accessor<GameData | undefined>
  profiles: Accessor<Profile[] | undefined>
}

export function RootStoreProvider(props: RootStoreProviderProps) {
  return (
    <GameDataProvider data={props.gameData}>
      <ProfilesStoreProvider serverProfiles={props.profiles}>
        <PullHistoryProvider>
          <UIStoreProvider>
            {props.children}
          </UIStoreProvider>
        </PullHistoryProvider>
      </ProfilesStoreProvider>
    </GameDataProvider>
  )
}
