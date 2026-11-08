import {useEffect} from 'react';
import {Alert} from 'react-native';
import type {RequestScope} from '../services/requestScope';
import type {Conversation} from '../models/PersistentMessaging';
import {usePropertyViewingsViewModel} from '../viewModels/usePropertyViewingsViewModel';
import {useRentalReservationsViewModel} from '../viewModels/useRentalReservationsViewModel';
import {PropertyViewingsView} from './PropertyViewingsView';
import {RentalReservationsView} from './RentalReservationsView';
export function ReservationsWorkspace({accountId,conversation,onBack,registerBackAction,scope,onOpenConversation,onLocked}:{accountId:string|undefined;conversation:Conversation|null;onBack:()=>void;registerBackAction:((action:(()=>void)|null)=>void)|undefined;scope?:RequestScope|undefined;onLocked?:((locked:boolean)=>void)|undefined;onOpenConversation?:((id:string)=>void)|undefined}){
 const vm=useRentalReservationsViewModel(accountId,conversation,scope);
 useEffect(()=>{onLocked?.(!!vm.editor||vm.saving||vm.uncertain);return()=>onLocked?.(false);},[!!vm.editor,vm.saving,vm.uncertain,onLocked]);
 const back=()=>{if(vm.saving)return;if(vm.uncertain){Alert.alert('Reservation outcome not confirmed','Retry the same request to confirm its outcome, or leave and refresh reservations before requesting again.',[{text:'Keep reviewing',style:'cancel'},{text:'Leave reservations',onPress:onBack}]);return;}if(vm.editor){vm.workflow.closeEditor();void vm.workflow.load();}else onBack();};
 useEffect(()=>{registerBackAction?.(back);return()=>registerBackAction?.(null);});
 return <RentalReservationsView embedded={!!scope} viewModel={vm} onBack={back} onOpenConversation={onOpenConversation}/>;
}
export function ViewingsWorkspace({accountId,conversation,onBack,registerBackAction,scope,onOpenConversation,onLocked}:{accountId:string|undefined;conversation:Conversation|null;onBack:()=>void;registerBackAction:((action:(()=>void)|null)=>void)|undefined;scope?:RequestScope|undefined;onLocked?:((locked:boolean)=>void)|undefined;onOpenConversation?:((id:string)=>void)|undefined}){
 const vm=usePropertyViewingsViewModel(accountId,conversation,scope);
 useEffect(()=>{onLocked?.(!!vm.editor||vm.saving||vm.uncertain);return()=>onLocked?.(false);},[!!vm.editor,vm.saving,vm.uncertain,onLocked]);
 const back=()=>{if(vm.saving)return;if(vm.uncertain){Alert.alert('Viewing outcome not confirmed','Retry the same request to confirm its outcome, or leave and refresh appointments before making another request.',[{text:'Keep reviewing',style:'cancel'},{text:'Leave viewings',onPress:onBack}]);return;}if(vm.editor){vm.workflow.closeEditor();void vm.workflow.load();}else onBack();};
 useEffect(()=>{registerBackAction?.(back);return()=>registerBackAction?.(null);});
 return <PropertyViewingsView embedded={!!scope} viewModel={vm} onBack={back} onOpenConversation={onOpenConversation}/>;
}
