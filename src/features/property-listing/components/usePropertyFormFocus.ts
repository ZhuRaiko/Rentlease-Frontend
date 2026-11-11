import {useEffect,useRef} from 'react';
import {AccessibilityInfo,type ScrollView,type TextInput,type View} from 'react-native';
import type {PropertyValidationField,PropertyValidationIssue,PropertyValidationSection} from '../models/DraftProperty';
export interface PropertyFocusRequest extends PropertyValidationIssue {requestId:number}
export function performPropertyFocus(request:PropertyFocusRequest,section:View|undefined,content:View|null,scroll:ScrollView|null,input:TextInput|undefined|(()=>TextInput|undefined),current:()=>boolean,announce:(text:string)=>void) {
  if(!section||!content||!scroll||!current())return;
  section.measureLayout(content,(_x,y)=>{
    if(!current())return;
    scroll.scrollTo({y:Math.max(0,y-16),animated:true});
    // Native input refs exist only for visible editable controls in this form.
    (typeof input==='function'?input():input)?.focus();announce(request.message);
  },()=>{if(current())announce(request.message);});
}
export function usePropertyFormFocus(request:PropertyFocusRequest|null|undefined,sectionOverride?:'details') {
  const scrollRef=useRef<ScrollView|null>(null),contentRef=useRef<View|null>(null);
  const sections=useRef<Partial<Record<PropertyValidationSection|'details',View>>>({});
  const inputs=useRef<Partial<Record<PropertyValidationField,TextInput>>>({});
  useEffect(()=>{
    if(!request)return;
    let active=true;
    const frame=requestAnimationFrame(()=>performPropertyFocus(request,sections.current[sectionOverride??request.section],contentRef.current,scrollRef.current,()=>inputs.current[request.field],()=>active,AccessibilityInfo.announceForAccessibility));
    return ()=>{active=false;cancelAnimationFrame(frame);};
  },[request?.requestId,request?.field,request?.message,sectionOverride]);
  return {scrollRef,contentRef,
    section:(key:PropertyValidationSection|'details')=>(node:View|null)=>{if(node)sections.current[key]=node;else delete sections.current[key];},
    field:(key:PropertyValidationField)=>(node:TextInput|null)=>{if(node)inputs.current[key]=node;else delete inputs.current[key];},
  };
}
export type PropertyFormFocus=ReturnType<typeof usePropertyFormFocus>;
