import {createContext,useContext} from 'react';
/** Presentation role only; the database always authorizes the real account. */
/** @type {import('react').Context<any>} */
export const RoleWorkspaceContext=createContext({role:null,actualRole:null,preview:false,tab:'dashboard',profile:null,user:null,isAdmin:false,onNavigate:(_tab='dashboard')=>{}});
export const useRoleWorkspace=()=>useContext(RoleWorkspaceContext);
