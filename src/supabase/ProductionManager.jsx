/** Roster must never land on the unrelated production-team manager. */
import React from 'react';
import ProductionManagerBase from './ProductionManagerBase';
import RosterPanel from './RosterPanel';
import {useRoleWorkspace} from './RoleWorkspaceContext';
export default function ProductionManager(props){const w=useRoleWorkspace();return w.tab==='roster'?<RosterPanel {...props} role={w.role} preview={w.preview}/>:<ProductionManagerBase {...props}/>;}
