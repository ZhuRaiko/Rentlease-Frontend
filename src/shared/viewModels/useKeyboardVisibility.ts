import {useEffect,useState} from 'react';
import {Keyboard} from 'react-native';
export function useKeyboardVisibility(){
 const [visible,setVisible]=useState(()=>(Keyboard.metrics()?.height??0)>0);
 useEffect(()=>{const show=Keyboard.addListener('keyboardDidShow',event=>setVisible(event.endCoordinates.height>0)),hide=Keyboard.addListener('keyboardDidHide',()=>setVisible(false));return()=>{show.remove();hide.remove();};},[]);
 return visible;
}
